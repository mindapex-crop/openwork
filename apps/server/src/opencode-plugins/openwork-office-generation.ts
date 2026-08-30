import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateOfficeFile, isOfficeFormat, type OfficeFormat } from "./openwork-office-generation-core.js";

/**
 * OpenCode plugin that turns an `openwork:deliver` instruction inside an
 * assistant text part into a materialized Office deliverable file part
 * (docx / pptx / xlsx / pdf). The actual generation is a pure function in
 * openwork-office-generation-core.ts; this module only wires it into the
 * message pipeline ("对话到交付" workflow).
 *
 * Instruction text format (JSON payload after the marker line):
 *   openwork:deliver
 *   {"format":"docx","filename":"quarterly.docx","content":"# Quarterly\n..."}
 */

type RuntimeContext = {
  directory?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : undefined;
}

function normalizeOpenCodeContext(value: unknown): RuntimeContext {
  const directory = optionalStringProperty(value, "directory");
  return {
    ...(directory ? { directory } : {}),
  };
}

const DELIVER_MARKER = "openwork:deliver";

function tryParseDeliverInstruction(text: string): {
  format: OfficeFormat;
  filename: string;
  content: string;
} | null {
  const trimmed = text.trimStart();
  const markerEnd = trimmed.startsWith(`${DELIVER_MARKER}\n`)
    ? DELIVER_MARKER.length + 1
    : trimmed.startsWith(`${DELIVER_MARKER}\r\n`)
      ? DELIVER_MARKER.length + 2
      : -1;
  if (markerEnd < 0) return null;
  const payload = trimmed.slice(markerEnd).trim();
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const format = parsed.format;
  if (typeof format !== "string" || !isOfficeFormat(format)) return null;
  const content = typeof parsed.content === "string" ? parsed.content : "";
  const filename = optionalStringProperty(parsed, "filename");
  return { format, filename: filename ?? "", content };
}

function basePartIds(part: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["id", "sessionID", "messageID", "sessionId", "messageId"]) {
    const value = part[key];
    if (typeof value === "string" || typeof value === "number") result[key] = value;
  }
  return result;
}

async function materializeDeliverable(root: string | null, filename: string, buffer: Buffer): Promise<string | null> {
  if (!root) return null;
  const dir = join(root, ".opencode", "openwork", "outbox", "deliverables");
  await mkdir(dir, { recursive: true });
  const safeName = filename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120) || "deliverable";
  const path = join(dir, safeName);
  await writeFile(path, buffer);
  return path;
}

async function transformPart(value: unknown, root: string | null): Promise<unknown> {
  if (!isRecord(value) || value.type !== "text") return value;
  const text = optionalStringProperty(value, "text");
  if (!text) return value;
  const instruction = tryParseDeliverInstruction(text);
  if (!instruction) return value;
  const result = generateOfficeFile({
    content: instruction.content,
    format: instruction.format,
    filename: instruction.filename,
  });
  const relativePath = await materializeDeliverable(root, result.filename, result.buffer);
  if (!relativePath) {
    // No workspace root to write into: deliver as an inline data URL part.
    return {
      ...basePartIds(value),
      type: "file",
      filename: result.filename,
      mediaType: result.mime,
      url: `data:${result.mime};base64,${result.buffer.toString("base64")}`,
    };
  }
  return {
    ...basePartIds(value),
    type: "file",
    filename: result.filename,
    mediaType: result.mime,
    url: `file://${relativePath}`,
    path: relativePath,
  };
}

async function transformMessage(value: unknown, root: string | null): Promise<unknown> {
  if (!isRecord(value)) return value;
  if (Array.isArray(value.parts)) {
    return { ...value, parts: await Promise.all(value.parts.map((part) => transformPart(part, root))) };
  }
  if (Array.isArray(value.content)) {
    return { ...value, content: await Promise.all(value.content.map((part) => transformPart(part, root))) };
  }
  return value;
}

// Single export: the OpenCode plugin loader treats every export of a plugin
// module as a plugin factory, so helpers must stay module-private.
export const OpenWorkOfficeGeneration = async (factoryInput?: unknown) => {
  const factoryContext = normalizeOpenCodeContext(factoryInput);
  const root = factoryContext.directory ? join(factoryContext.directory) : null;
  return {
    "experimental.chat.messages.transform": async (input: unknown, output: { messages: unknown[] }) => {
      void input;
      const messages = await Promise.all(output.messages.map((message) => transformMessage(message, root)));
      output.messages.splice(0, output.messages.length, ...messages);
    },
  };
};
