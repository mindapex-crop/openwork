import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateOfficeFile } from "./openwork-office-generation-core.js";
import { OpenWorkOfficeGeneration } from "./openwork-office-generation.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

const DOCX_SENTINEL = "Quarterly revenue reached 1742.42.";
const PPTX_SENTINEL = "Launch window opens 2026-09-17.";
const XLSX_SENTINEL = "Northstar Revenue";
const PDF_SENTINEL = "Executive summary for the board.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(part: unknown): string {
  const record = isRecord(part) ? part : null;
  if (!record || typeof record.text !== "string") throw new Error("Expected text part");
  return record.text;
}

async function withWorkspace(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "openwork-office-generation-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function transform(root: string, messages: unknown[]) {
  const plugin = await OpenWorkOfficeGeneration({ directory: root });
  const output = { messages: structuredClone(messages) };
  await plugin["experimental.chat.messages.transform"]({ context: { sessionID: "ses_gen" } }, output);
  return output.messages;
}

function deliverPartText(format: string, filename: string, content: string): Record<string, unknown> {
  return {
    id: "part-deliver",
    type: "text",
    text: `openwork:deliver\n${JSON.stringify({ format, filename, content })}`,
  };
}

function dataUrl(mime: string, buffer: Buffer) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

describe("generateOfficeFile", () => {
  test("docx: produces a valid ZIP whose stored document.xml contains the content", () => {
    const result = generateOfficeFile({ content: `# Report\n\n${DOCX_SENTINEL}`, format: "docx", filename: "report.docx" });
    expect(result.format).toBe("docx");
    expect(result.filename).toBe("report.docx");
    expect(result.mime).toBe(DOCX_MIME);
    expect(result.size).toBe(result.buffer.byteLength);
    expect(result.size).toBeGreaterThan(0);
    expect(result.buffer.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    expect(result.buffer.toString("utf8")).toContain(DOCX_SENTINEL);
    expect(result.buffer.toString("utf8")).toContain("word/document.xml");
  });

  test("pptx: produces a valid ZIP whose stored slide XML contains the content", () => {
    const result = generateOfficeFile({ content: `# Launch\n\n${PPTX_SENTINEL}`, format: "pptx", filename: "deck.pptx" });
    expect(result.mime).toBe(PPTX_MIME);
    expect(result.buffer.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    const text = result.buffer.toString("utf8");
    expect(text).toContain(PPTX_SENTINEL);
    expect(text).toContain("ppt/slides/slide1.xml");
  });

  test("xlsx: produces a valid ZIP whose stored worksheet XML contains the content", () => {
    const result = generateOfficeFile({
      content: `| Item | Amount |\n| --- | --- |\n| ${XLSX_SENTINEL} | 1742.42 |`,
      format: "xlsx",
      filename: "workbook.xlsx",
    });
    expect(result.mime).toBe(XLSX_MIME);
    expect(result.buffer.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    const text = result.buffer.toString("utf8");
    expect(text).toContain(XLSX_SENTINEL);
    expect(text).toContain("xl/worksheets/sheet1.xml");
  });

  test("pdf: starts with the PDF header, is parseable, and embeds the content", () => {
    const result = generateOfficeFile({ content: `# Board briefing\n\n${PDF_SENTINEL}`, format: "pdf", filename: "brief.pdf" });
    expect(result.mime).toBe(PDF_MIME);
    const text = result.buffer.toString("latin1");
    expect(text.startsWith("%PDF-1.")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(text).toContain("startxref");
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain(PDF_SENTINEL);
  });

  test("infers a default filename from the format", () => {
    const result = generateOfficeFile({ content: "plain", format: "pdf" });
    expect(result.filename).toBe("deliverable.pdf");
  });

  test("rejects unknown formats", () => {
    expect(() =>
      generateOfficeFile({ content: "x", format: "exe" as never }),
    ).toThrow(/unsupported/i);
  });

  test("empty content still yields a parseable file", () => {
    const docx = generateOfficeFile({ content: "", format: "docx" });
    expect(docx.buffer.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    const pdf = generateOfficeFile({ content: "", format: "pdf" });
    expect(pdf.buffer.toString("latin1").startsWith("%PDF-1.")).toBe(true);
  });
});

describe("OpenWorkOfficeGeneration deliverable transform", () => {
  test("converts an openwork:deliver text part into a docx file part", async () => {
    await withWorkspace(async (root) => {
      const messages = await transform(root, [{
        role: "assistant",
        parts: [deliverPartText("docx", "quarterly.docx", `# Quarterly\n\n${DOCX_SENTINEL}`)],
      }]);
      const part = isRecord(messages[0]) && Array.isArray(messages[0].parts) ? messages[0].parts[0] : null;
      const record = isRecord(part) ? part : null;
      expect(record?.type).toBe("file");
      expect(record?.filename).toBe("quarterly.docx");
      expect(record?.mediaType).toBe(DOCX_MIME);
      expect(record?.url).toStartWith("file://");
      expect(record?.path).toBeString();
      const materialized = await readFile(record?.path as string);
      expect(materialized.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    });
  });

  test("falls back to an inline data URL when no workspace root is available", async () => {
    const messages = await transform("", [{
      role: "assistant",
      parts: [deliverPartText("pdf", "brief.pdf", PDF_SENTINEL)],
    }]);
    const part = isRecord(messages[0]) && Array.isArray(messages[0].parts) ? messages[0].parts[0] : null;
    const record = isRecord(part) ? part : null;
    expect(record?.type).toBe("file");
    expect(record?.filename).toBe("brief.pdf");
    expect(record?.mediaType).toBe(PDF_MIME);
    expect(record?.url).toStartWith("data:");
  });

  test("leaves unrelated text parts untouched", async () => {
    const messages = await transform(join(tmpdir(), "unused"), [{
      role: "assistant",
      parts: [{ type: "text", text: "Here is the summary." }],
    }]);
    const part = isRecord(messages[0]) && Array.isArray(messages[0].parts) ? messages[0].parts[0] : null;
    const record = isRecord(part) ? part : null;
    expect(record?.type).toBe("text");
    expect(record?.text).toBe("Here is the summary.");
  });

  test("generated docx/xlsx/pptx round-trip through the attachments extractor", async () => {
    await withWorkspace(async (root) => {
      const docx = generateOfficeFile({ content: DOCX_SENTINEL, format: "docx" }).buffer;
      const pptx = generateOfficeFile({ content: PPTX_SENTINEL, format: "pptx" }).buffer;
      const xlsx = generateOfficeFile({ content: `| Item | Value |\n| ${XLSX_SENTINEL} | 1742.42 |`, format: "xlsx" }).buffer;

      const { OpenWorkOfficeAttachments } = await import("./openwork-office-attachments.js");
      const plugin = await OpenWorkOfficeAttachments({ directory: root });
      const output = { messages: structuredClone([{
        role: "user",
        parts: [
          { type: "file", filename: "a.docx", mediaType: DOCX_MIME, url: dataUrl(DOCX_MIME, docx) },
          { type: "file", filename: "b.pptx", mediaType: PPTX_MIME, url: dataUrl(PPTX_MIME, pptx) },
          { type: "file", filename: "c.xlsx", mediaType: XLSX_MIME, url: dataUrl(XLSX_MIME, xlsx) },
        ],
      }]) };
      await plugin["experimental.chat.messages.transform"]({ context: { sessionID: "ses_roundtrip" } }, output);
      const parts = isRecord(output.messages[0]) && Array.isArray(output.messages[0].parts)
        ? output.messages[0].parts
        : [];
      expect(parts.length).toBe(3);
      expect(textOf(parts[0])).toContain(DOCX_SENTINEL);
      expect(textOf(parts[1])).toContain(PPTX_SENTINEL);
      expect(textOf(parts[2])).toContain(XLSX_SENTINEL);
    });
  });
});
