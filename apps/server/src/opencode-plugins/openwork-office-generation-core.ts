/**
 * Pure Office document generation: markdown/text -> docx / pptx / xlsx / pdf
 * byte buffers, with no runtime dependency beyond Node's stdlib.
 *
 * - docx / pptx / xlsx are minimal OOXML packages assembled as STORED ZIP
 *   archives (no compression step, so the XML payloads are readable straight
 *   off the bytes, and the structure round-trips through the attachment
 *   extractor in openwork-office-attachments.ts).
 * - pdf is a hand-written PDF 1.4 document (Helvetica text layout) so the
 *   header is `%PDF-` and the file parses in standard viewers.
 *
 * This module is deliberately NOT a plugin module: the OpenCode plugin loader
 * treats every export of a plugin module as a plugin factory, so the reusable
 * functions live here and the plugin wrapper lives in
 * openwork-office-generation.ts.
 */

export type OfficeFormat = "docx" | "pptx" | "xlsx" | "pdf";

export interface OfficeGenerationInput {
  content: string;
  format: OfficeFormat;
  filename?: string;
}

export interface OfficeGenerationResult {
  format: OfficeFormat;
  filename: string;
  mime: string;
  buffer: Buffer;
  size: number;
}

export const OFFICE_MIME: Readonly<Record<OfficeFormat, string>> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export const OFFICE_EXTENSION: Readonly<Record<OfficeFormat, string>> = {
  docx: "docx",
  pptx: "pptx",
  xlsx: "xlsx",
  pdf: "pdf",
};

// ---------------------------------------------------------------------------
// ZIP (STORED) writer
// ---------------------------------------------------------------------------

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // STORED
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, name);

    offset += 30 + name.length + file.data.length;
  }

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localChunks, ...centralChunks, end]);
}

// ---------------------------------------------------------------------------
// Shared markdown helpers
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type MdBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; text: string }
  | { kind: "code"; text: string }
  | { kind: "table"; rows: string[][] };

function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const cells = trimmed
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  return cells.length > 0 ? cells : null;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "").trim();
  return body.length > 0 && /^[\s:\-|]+$/.test(body) && body.includes("-");
}

function parseMarkdown(content: string): MdBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*(```|~~~)/.test(line)) {
      if (inCode) {
        blocks.push({ kind: "code", text: codeLines.join("\n") });
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").trim();
      if (text) blocks.push({ kind: "heading", level: Math.min(heading[1].length, 6), text });
      continue;
    }
    const listItem = /^\s*[-*+]\s+(.*)$/.exec(line) ?? /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (listItem && (listItem[1] ?? "").trim()) {
      blocks.push({ kind: "list", text: (listItem[1] ?? "").trim() });
      continue;
    }
    if (isTableSeparator(line)) continue;
    const cells = splitTableRow(line);
    if (cells) {
      blocks.push({ kind: "table", rows: [cells] });
      continue;
    }
    const trimmed = line.trim();
    if (trimmed) blocks.push({ kind: "paragraph", text: trimmed });
  }
  if (inCode && codeLines.length) blocks.push({ kind: "code", text: codeLines.join("\n") });
  return blocks;
}

/** Combine consecutive table blocks into one. */
function consolidateTables(blocks: MdBlock[]): MdBlock[] {
  const result: MdBlock[] = [];
  for (const block of blocks) {
    const last = result[result.length - 1];
    if (block.kind === "table" && last?.kind === "table") {
      result[result.length - 1] = { kind: "table", rows: [...last.rows, ...block.rows] };
    } else {
      result.push(block);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function docxParagraph(block: MdBlock): string {
  switch (block.kind) {
    case "heading": {
      const text = escapeXml(block.text);
      const style = block.level <= 1 ? "Title" : `Heading${Math.min(block.level, 3)}`;
      return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    }
    case "list": {
      const text = escapeXml(block.text);
      return `<w:p><w:pPr><w:numPr><w:numId w:val="1"/><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    }
    case "code": {
      const text = escapeXml(block.text);
      return `<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    }
    case "table": {
      const rows = block.rows
        .map((row) => {
          const cells = row
            .map((cell) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`)
            .join("");
          return `<w:tr>${cells}</w:tr>`;
        })
        .join("");
      return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders></w:tblPr>${rows}</w:tbl>`;
    }
    case "paragraph": {
      const text = escapeXml(block.text);
      return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    }
    default:
      return "";
  }
}

function buildDocx(content: string): Buffer {
  const blocks = consolidateTables(parseMarkdown(content));
  const body = blocks.map(docxParagraph).join("");
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    { name: "word/document.xml", data: Buffer.from(documentXml) },
  ]);
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

function pptxParagraph(block: MdBlock, index: number): string {
  switch (block.kind) {
    case "heading":
      return `<a:p><a:pPr lvl="${Math.min(block.level - 1, 4)}"/><a:r><a:rPr lang="en-US" sz="${3600 - Math.min(block.level - 1, 2) * 200}" b="1"/><a:t>${escapeXml(block.text)}</a:t></a:r></a:p>`;
    case "list":
      return `<a:p><a:pPr lvl="0" marL="228600" indent="-228600"/><a:r><a:rPr lang="en-US"/><a:t>• ${escapeXml(block.text)}</a:t></a:r></a:p>`;
    case "code":
      return `<a:p><a:r><a:rPr lang="en-US" font="Courier New" sz="1600"/><a:t>${escapeXml(block.text)}</a:t></a:r></a:p>`;
    case "table": {
      const rows = block.rows
        .map((row) => `<a:tr h="370840">${row.map((cell) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${escapeXml(cell)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`).join("")}</a:tr>`)
        .join("");
      return `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid>${row(block.rows, 0).map(() => '<a:gridCol w="1200000"/>').join("")}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic>`;
    }
    default:
      return `<a:p><a:r><a:rPr lang="en-US"/><a:t>${escapeXml(block.text)}</a:t></a:r></a:p>`;
  }
}

function row(rows: string[][], index: number): string[] {
  return rows[index] ?? [];
}

function buildPptx(content: string): Buffer {
  const blocks = consolidateTables(parseMarkdown(content));
  const paragraphs = blocks.map((block, index) => pptxParagraph(block, index)).join("");
  const slideXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Content Placeholder"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="8229600" cy="5943600"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

  return buildZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
      ),
    },
    {
      name: "ppt/presentation.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
      ),
    },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`,
      ),
    },
    {
      name: "ppt/slideMasters/slideMaster1.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400" kern="1200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr/></p:bodyStyle><p:otherStyle/></p:txStyles></p:sldMaster>`,
      ),
    },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
      ),
    },
    {
      name: "ppt/slideLayouts/slideLayout1.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
      ),
    },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
      ),
    },
    {
      name: "ppt/theme/theme1.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
      ),
    },
    {
      name: "ppt/slides/slide1.xml",
      data: Buffer.from(slideXml),
    },
  ]);
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

function xlsxCell(reference: string, value: string): string {
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildXlsx(content: string): Buffer {
  const blocks = consolidateTables(parseMarkdown(content));
  const rows: Array<Array<string | null>> = [];
  for (const block of blocks) {
    if (block.kind === "table") {
      for (const rowCells of block.rows) {
        rows.push([...rowCells]);
      }
    } else {
      const text = block.kind === "heading" ? `# ${block.text}` : block.text;
      for (const line of text.split(/\n/)) {
        rows.push(line.trim() ? [line.trim()] : [""]);
      }
    }
  }
  if (rows.length === 0) rows.push([""]);

  const columnCount = Math.max(...rows.map((cells) => cells.length), 1);
  const sheetRows = rows
    .map((cells, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cellXml = Array.from({ length: columnCount }, (_, columnIndex) => {
        const value = cells[columnIndex] ?? "";
        if (value === "" && columnIndex > 0) return "";
        return xlsxCell(`${String.fromCharCode(65 + columnIndex)}${rowNumber}`, value);
      })
        .filter(Boolean)
        .join("");
      return `<row r="${rowNumber}">${cellXml}</row>`;
    })
    .join("");

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  return buildZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/styles.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`,
      ),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from(sheetXml),
    },
  ]);
}

// ---------------------------------------------------------------------------
// PDF (hand-written PDF 1.4, Helvetica text layout)
// ---------------------------------------------------------------------------

function pdfEscapeText(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 40) out += "\\(";
    else if (code === 41) out += "\\)";
    else if (code === 92) out += "\\\\";
    else if (code >= 32 && code <= 126) out += character;
    else out += "?";
  }
  return out;
}

function pdfWrap(lines: string[], widthChars: number): string[] {
  const wrapped: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      wrapped.push("");
      continue;
    }
    for (let start = 0; start < line.length; start += widthChars) {
      wrapped.push(line.slice(start, start + widthChars));
    }
  }
  return wrapped;
}

function buildPdf(content: string): Buffer {
  const blocks = consolidateTables(parseMarkdown(content));
  const sourceLines: string[] = [];
  for (const block of blocks) {
    if (block.kind === "table") {
      for (const rowCells of block.rows) sourceLines.push(rowCells.join(" | "));
    } else {
      sourceLines.push(block.text);
    }
  }

  const fontSize = 11;
  const lineHeight = 15;
  const pageHeight = 792;
  const pageWidth = 612;
  const margin = 56;
  const maxChars = Math.floor((pageWidth - margin * 2) / (fontSize * 0.55));
  const lines = pdfWrap(sourceLines, Math.max(maxChars, 20));
  const linesPerPage = Math.max(Math.floor((pageHeight - margin * 2) / lineHeight), 1);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  // Fixed object layout so every cross-reference is known up front:
  //   1: Catalog           (Pages -> 2)
  //   2: Pages             (Kids -> 3..2+P)
  //   3..2+P:   Page i     (Parent -> 2, Contents -> 2+P+i, F1 -> 2+2P+1)
  //   2+P+1..2+2P: stream i
  //   2+2P+1: Font /Helvetica
  const pageCount = pages.length;
  const fontId = 2 + 2 * pageCount + 1;

  const objectBodies: string[] = [];
  const pushObject = (id: number, body: string) => {
    objectBodies.push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const pageRefs = pages.map((_page, index) => `${3 + index} 0 R`).join(" ");
  pushObject(2, `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`);

  const fontBody = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageLines, index) => {
    const pageId = 3 + index;
    const contentId = 2 + pageCount + 1 + index;
    pushObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  pages.forEach((pageLines, index) => {
    const contentId = 2 + pageCount + 1 + index;
    const stream = pageLines
      .map((line, lineIndex) => {
        const y = pageHeight - margin - (lineIndex + 1) * lineHeight;
        return `BT /F1 ${fontSize} Tf ${margin} ${y} Td (${pdfEscapeText(line)}) Tj ET`;
      })
      .join("\n");
    const streamLength = Buffer.byteLength(stream, "latin1");
    pushObject(contentId, `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
  });
  pushObject(fontId, fontBody);
  pushObject(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  let cursor = Buffer.byteLength(chunks[0] as Buffer, "latin1");
  const offsets: number[] = [];
  for (const body of objectBodies) {
    offsets.push(cursor);
    const block = Buffer.from(body, "latin1");
    chunks.push(block);
    cursor += block.byteLength;
  }
  const xrefOffset = cursor;
  const xref =
    `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  const trailer =
    `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"), Buffer.from(trailer, "latin1"));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isOfficeFormat(value: string): value is OfficeFormat {
  return value === "docx" || value === "pptx" || value === "xlsx" || value === "pdf";
}

export function generateOfficeFile(input: OfficeGenerationInput): OfficeGenerationResult {
  const format = input.format;
  if (!isOfficeFormat(format)) {
    throw new Error(`Unsupported office format: ${String(format)}`);
  }
  const content = input.content ?? "";
  const filename = input.filename?.trim() || `deliverable.${OFFICE_EXTENSION[format]}`;
  let buffer: Buffer;
  switch (format) {
    case "docx":
      buffer = buildDocx(content);
      break;
    case "pptx":
      buffer = buildPptx(content);
      break;
    case "xlsx":
      buffer = buildXlsx(content);
      break;
    case "pdf":
      buffer = buildPdf(content);
      break;
  }
  return {
    format,
    filename,
    mime: OFFICE_MIME[format],
    buffer,
    size: buffer.byteLength,
  };
}
