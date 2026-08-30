import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { SkillItem } from "./types.js";
import { parseFrontmatter, buildFrontmatter } from "./frontmatter.js";
import { exists } from "./utils.js";
import { validateDescription, validateSkillName } from "./validators.js";
import { ApiError } from "./errors.js";
import { projectSkillsDir } from "./workspace-files.js";

async function findWorkspaceRoots(workspaceRoot: string): Promise<string[]> {
  const roots: string[] = [];
  let current = resolve(workspaceRoot);
  while (true) {
    roots.push(current);
    const gitPath = join(current, ".git");
    if (await exists(gitPath)) break;
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return roots;
}

const extractTriggerFromBody = (body: string) => {
  const lines = body.split(/\r?\n/);
  let inWhenSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#{1,6}\s+/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,6}\s+/, "").trim();
      inWhenSection = /^when to use$/i.test(heading);
      continue;
    }

    if (!inWhenSection) continue;

    const cleaned = trimmed
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .trim();

    if (cleaned) return cleaned;
  }

  return "";
};

async function parseSkillEntry(
  skillPath: string,
  entryName: string,
  scope: "project" | "global",
): Promise<SkillItem | null> {
  const content = await readFile(skillPath, "utf8");
  const { data, body } = parseFrontmatter(content);
  const name = typeof data.name === "string" ? data.name : entryName;
  const description = typeof data.description === "string" ? data.description : "";
  const trigger =
    typeof data.trigger === "string"
      ? data.trigger
      : typeof data.when === "string"
        ? data.when
        : extractTriggerFromBody(body);
  try {
    validateSkillName(name);
    validateDescription(description);
  } catch {
    return null;
  }
  if (name !== entryName) return null;
  return {
    name,
    description,
    path: skillPath,
    scope,
    trigger: trigger.trim() || undefined,
  };
}

async function listSkillsInDir(dir: string, scope: "project" | "global"): Promise<SkillItem[]> {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return [];

      const skillPath = join(dir, entry.name, "SKILL.md");
      if (await exists(skillPath)) {
        // Direct skill: <dir>/<name>/SKILL.md
        const item = await parseSkillEntry(skillPath, entry.name, scope);
        return item ? [item] : [];
      }

      // Domain/category folder: <dir>/<domain>/<name>/SKILL.md – scan one level deeper.
      // This supports the convention where global skills are organised as
      //   skills/<domain>/<skill-name>/SKILL.md
      // in addition to the flat   skills/<skill-name>/SKILL.md  layout.
      const domainDir = join(dir, entry.name);
      let subEntries: Dirent[];
      try {
        subEntries = await readdir(domainDir, { withFileTypes: true });
      } catch {
        return [];
      }

      const subGroups = await Promise.all(
        subEntries.map(async (subEntry) => {
          if (!subEntry.isDirectory()) return [];

          const subSkillPath = join(domainDir, subEntry.name, "SKILL.md");
          if (!(await exists(subSkillPath))) return [];

          const item = await parseSkillEntry(subSkillPath, subEntry.name, scope);
          return item ? [item] : [];
        }),
      );
      return subGroups.flat();
    }),
  );
  return groups.flat();
}

export async function listSkills(workspaceRoot: string, includeGlobal: boolean): Promise<SkillItem[]> {
  const roots = await findWorkspaceRoots(workspaceRoot);
  const dirs: { dir: string; scope: "project" | "global" }[] = [];
  for (const root of roots) {
    const opencodeDir = join(root, ".opencode", "skills");
    const claudeDir = join(root, ".claude", "skills");
    dirs.push({ dir: opencodeDir, scope: "project" });
    dirs.push({ dir: claudeDir, scope: "project" });
  }

  if (includeGlobal) {
    const globalOpenWork = join(homedir(), ".config", "opencode", "skills");
    const globalClaude = join(homedir(), ".claude", "skills");
    const globalAgents = join(homedir(), ".agents", "skills");
    const globalAgentLegacy = join(homedir(), ".agent", "skills");
    dirs.push({ dir: globalOpenWork, scope: "global" });
    dirs.push({ dir: globalClaude, scope: "global" });
    dirs.push({ dir: globalAgents, scope: "global" });
    dirs.push({ dir: globalAgentLegacy, scope: "global" });
  }

  const groups = await Promise.all(dirs.map(({ dir, scope }) => listSkillsInDir(dir, scope)));
  const items = groups.flat();

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

export type UpsertSkillPayload = {
  name: string;
  content: string;
  description?: string;
};

export function buildSkillContent(payload: UpsertSkillPayload): { name: string; content: string } {
  const name = payload.name.trim();
  validateSkillName(name);
  if (!payload.content) {
    throw new ApiError(400, "invalid_skill_content", "Skill content is required");
  }

  let content = payload.content;
  const { data, body } = parseFrontmatter(payload.content);
  if (Object.keys(data).length > 0) {
    const frontmatterName = typeof data.name === "string" ? data.name : "";
    const frontmatterDescription = typeof data.description === "string" ? data.description : "";
    if (frontmatterName && frontmatterName !== name) {
      throw new ApiError(400, "invalid_skill_name", "Skill frontmatter name must match payload name");
    }
    validateDescription(frontmatterDescription || payload.description);
    const nextDescription = frontmatterDescription || payload.description || "";
    const frontmatter = buildFrontmatter({
      ...data,
      name,
      description: nextDescription,
    });
    content = frontmatter + body.replace(/^\n/, "");
  } else {
    validateDescription(payload.description);
    const frontmatter = buildFrontmatter({ name, description: payload.description });
    content = frontmatter + payload.content.replace(/^\n/, "");
  }

  return {
    name,
    content: content.endsWith("\n") ? content : content + "\n",
  };
}

export async function upsertSkill(
  workspaceRoot: string,
  payload: UpsertSkillPayload,
): Promise<{ path: string; action: "added" | "updated" }> {
  const skill = buildSkillContent(payload);

  const baseDir = projectSkillsDir(workspaceRoot);
  const skillDir = join(baseDir, skill.name);
  await mkdir(skillDir, { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  const existed = await exists(skillPath);
  await writeFile(skillPath, skill.content, "utf8");
  return { path: skillPath, action: existed ? "updated" : "added" };
}

export async function deleteSkill(workspaceRoot: string, name: string): Promise<{ path: string }> {
  const trimmed = name.trim();
  validateSkillName(trimmed);
  const baseDir = projectSkillsDir(workspaceRoot);
  const flatDir = join(baseDir, trimmed);
  if (await exists(join(flatDir, "SKILL.md"))) {
    await rm(flatDir, { recursive: true, force: true });
    return { path: flatDir };
  }
  // Nested layout: skills/<domain>/<name>/SKILL.md (e.g. skills installed by
  // marketplace plugin bundles are namespaced under a plugin folder). Listing
  // supports this layout, so deletion must resolve it the same way.
  const items = await listSkills(workspaceRoot, false);
  const item = items.find((skill) => skill.name === trimmed && skill.scope === "project");
  if (!item) {
    throw new ApiError(404, "skill_not_found", `Skill not found: ${trimmed}`);
  }
  const skillDir = dirname(item.path);
  await rm(skillDir, { recursive: true, force: true });
  return { path: skillDir };
}

// ---------------------------------------------------------------------------
// Built-in Office delivery skills ("对话到交付" workflow)
// ---------------------------------------------------------------------------

export interface BuiltinSkillDescriptor {
  name: string;
  description: string;
  trigger?: string;
  content: string;
}

const OFFICE_DOC_SKILL_CONTENT = `---
name: office-doc
description: 将对话结论生成为 Word 文档（.docx）交付物。当用户要求"导出为 Word 文档 / 生成 docx 文档 / 出一份正式报告文件"时使用。
---

# Skill: office-doc

"对话到交付"工作流：把当前对话中的结论、要点、表格整理成 markdown 结构，再生成 \`.docx\` 交付文件，让用户直接下载或保存。

## 工作流

1. **整理内容**：从对话中提取标题、段落、列表、表格与代码块，组织为清晰的 markdown 文本。
2. **调用生成能力**：调用服务端的 \`generateOfficeFile({ content, format: "docx", filename })\` 纯函数（\`apps/server/src/opencode-plugins/openwork-office-generation-core.ts\`），或通过 \`openwork:deliver\` 指令让插件代为生成：

   \`\`\`
   openwork:deliver
   {"format":"docx","filename":"report.docx","content":"# 标题\\n\\n正文…"}
   \`\`\`

3. **交付**：生成的文件会作为 file part 写入工作区 \`.opencode/openwork/outbox/deliverables/\` 并附到消息上。告知用户文件位置与内容摘要。

## 生成规范

- 标题用 \`# \`（一级）/ \`## \`（二级）markdown 前缀，生成后映射为 Word 标题样式。
- 表格用 \`| 列 | 列 |\` 管道语法，生成真实 Word 表格。
- 列表项用 \`- \` 前缀，生成 Word 编号/项目符号列表。
- 代码块用 \`\`\`\` \`\`\`\` 围栏，生成等宽字体段落。
- 文件命名：\`<主题>.docx\`，避免空格与特殊字符。

## 验收

- 文件以 \`PK\` 开头（合法 zip/OOXML），能被 Word/WPS/LibreOffice 打开。
- 正文、标题、表格内容与对话结论一致，无遗漏、无编造。
- 交付后给出文件路径与字数/表格数摘要。
`;

const OFFICE_SLIDE_SKILL_CONTENT = `---
name: office-slide
description: 将对话内容生成为演示文稿（.pptx）交付物。当用户要求"做成 PPT / 生成幻灯片 / 出一版演示文稿"时使用。
---

# Skill: office-slide

"对话到交付"工作流：把对话结论整理为演示文稿 \`.pptx\` 交付文件。

## 工作流

1. **整理大纲**：从对话中提取演示结构：标题、要点、表格，组织为 markdown（\`# \` 标题 = 幻灯片内容主题，\`- \` 列表 = 要点）。
2. **调用生成能力**：调用服务端的 \`generateOfficeFile({ content, format: "pptx", filename })\` 纯函数（\`apps/server/src/opencode-plugins/openwork-office-generation-core.ts\`），或通过 \`openwork:deliver\` 指令：

   \`\`\`
   openwork:deliver
   {"format":"pptx","filename":"deck.pptx","content":"# 主题\\n\\n- 要点一\\n- 要点二"}
   \`\`\`

3. **交付**：生成文件写入 \`.opencode/openwork/outbox/deliverables/\` 并附到消息。告知文件位置与页数摘要。

## 生成规范

- \`# \` 一级标题渲染为加粗大字，作为页面主标题。
- \`- \` 列表渲染为项目符号要点；\`| 列 |\` 表格渲染为幻灯片表格。
- 一页内容不宜过长：正文保持 6–8 行要点以内。
- 文件命名：\`<主题>.pptx\`。

## 验收

- 文件以 \`PK\` 开头（合法 OOXML），能被 PowerPoint/WPS/LibreOffice 打开。
- 标题与要点完整覆盖对话结论，无编造数据。
- 交付后给出文件路径与要点条数摘要。
`;

const OFFICE_SHEET_SKILL_CONTENT = `---
name: office-sheet
description: 将对话数据生成为电子表格（.xlsx）交付物。当用户要求"导出为 Excel / 生成 xlsx 表格 / 把数据做成表"时使用。
---

# Skill: office-sheet

"对话到交付"工作流：把对话中的数据整理为电子表格 \`.xlsx\` 交付文件。

## 工作流

1. **整理数据**：从对话中提取结构化数据（表头 + 行）。用 markdown 表格表达：

   \`\`\`
   | 指标 | 数值 |
   | --- | --- |
   | 收入 | 1742.42 |
   \`\`\`

   非表格内容（说明性文字）会逐行写入 A 列，请优先使用表格表达数据。
2. **调用生成能力**：调用服务端的 \`generateOfficeFile({ content, format: "xlsx", filename })\` 纯函数（\`apps/server/src/opencode-plugins/openwork-office-generation-core.ts\`），或通过 \`openwork:deliver\` 指令：

   \`\`\`
   openwork:deliver
   {"format":"xlsx","filename":"workbook.xlsx","content":"| 指标 | 数值 |\\n| 收入 | 1742.42 |"}
   \`\`\`

3. **交付**：生成文件写入 \`.opencode/openwork/outbox/deliverables/\` 并附到消息。告知文件位置与行列摘要。

## 生成规范

- 每行一个 markdown 表格行 = 电子表格一行；单元格按 \`|\` 分隔。
- 表头行也按普通行写入（首行即表头数据）。
- 避免合并单元格/公式等复杂需求：当前生成器输出纯文本单元格。
- 文件命名：\`<主题>.xlsx\`。

## 验收

- 文件以 \`PK\` 开头（合法 OOXML），能被 Excel/WPS/LibreOffice 打开。
- 行、列与对话中的数据一一对应，数值无篡改。
- 交付后给出文件路径与行列数摘要。
`;

const OFFICE_PDF_SKILL_CONTENT = `---
name: office-pdf
description: 将对话内容生成为 PDF 文档交付物。当用户要求"导出为 PDF / 生成 pdf 文件 / 出一份可打印的文档"时使用。
---

# Skill: office-pdf

"对话到交付"工作流：把对话结论排版为 \`.pdf\` 交付文件（可直接打印、分享）。

## 工作流

1. **整理内容**：提取标题、段落、要点、表格，组织为 markdown。
2. **调用生成能力**：调用服务端的 \`generateOfficeFile({ content, format: "pdf", filename })\` 纯函数（\`apps/server/src/opencode-plugins/openwork-office-generation-core.ts\`），或通过 \`openwork:deliver\` 指令：

   \`\`\`
   openwork:deliver
   {"format":"pdf","filename":"brief.pdf","content":"# 摘要\\n\\n正文…"}
   \`\`\`

3. **交付**：生成文件写入 \`.opencode/openwork/outbox/deliverables/\` 并附到消息。告知文件位置与页数摘要。

## 生成规范

- 生成器输出标准 PDF 1.4（Helvetica 字体），以 \`%PDF\` 头开始，可被常见阅读器解析。
- 长内容自动分页；表格行按 \`| 列 |\` 拼接为文本行。
- 当前生成器为纯文本排版：中文字符会降级为 \`?\`，重要中文内容请优先交付 docx。
- 文件命名：\`<主题>.pdf\`。

## 验收

- 文件以 \`%PDF-1.\` 开头且含 \`%%EOF\`，能被 Preview / Acrobat / PDF.js 打开。
- 内容与对话结论一致，无遗漏。
- 交付后给出文件路径与页数摘要。
`;

/**
 * Built-in Office delivery skills registered with the server. Each descriptor
 * carries the full SKILL.md content so any workspace can materialize them via
 * ensureBuiltinOfficeSkills without depending on repository file layout.
 */
export const BUILTIN_OFFICE_SKILLS: readonly BuiltinSkillDescriptor[] = [
  {
    name: "office-doc",
    description: "将对话结论生成为 Word 文档（.docx）交付物",
    trigger: "导出为 Word 文档 / 生成 docx 文档 / 出一份正式报告文件",
    content: OFFICE_DOC_SKILL_CONTENT,
  },
  {
    name: "office-slide",
    description: "将对话内容生成为演示文稿（.pptx）交付物",
    trigger: "做成 PPT / 生成幻灯片 / 出一版演示文稿",
    content: OFFICE_SLIDE_SKILL_CONTENT,
  },
  {
    name: "office-sheet",
    description: "将对话数据生成为电子表格（.xlsx）交付物",
    trigger: "导出为 Excel / 生成 xlsx 表格 / 把数据做成表",
    content: OFFICE_SHEET_SKILL_CONTENT,
  },
  {
    name: "office-pdf",
    description: "将对话内容生成为 PDF 文档交付物",
    trigger: "导出为 PDF / 生成 pdf 文件 / 出一份可打印的文档",
    content: OFFICE_PDF_SKILL_CONTENT,
  },
];

export type EnsureBuiltinSkillResult = {
  name: string;
  path: string;
  action: "added" | "updated" | "unchanged";
};

/**
 * Materialize the built-in Office delivery skills into a workspace's
 * `.opencode/skills/<name>/SKILL.md` (idempotent). Returns the outcome for
 * each skill so callers can emit reload events for the changed ones.
 */
export async function ensureBuiltinOfficeSkills(workspaceRoot: string): Promise<EnsureBuiltinSkillResult[]> {
  const baseDir = projectSkillsDir(workspaceRoot);
  const results: EnsureBuiltinSkillResult[] = [];
  for (const skill of BUILTIN_OFFICE_SKILLS) {
    const skillDir = join(baseDir, skill.name);
    await mkdir(skillDir, { recursive: true });
    const skillPath = join(skillDir, "SKILL.md");
    const existed = await exists(skillPath);
    const current = existed ? await readFile(skillPath, "utf8") : null;
    if (current === skill.content) {
      results.push({ name: skill.name, path: skillPath, action: "unchanged" });
      continue;
    }
    await writeFile(skillPath, skill.content, "utf8");
    results.push({ name: skill.name, path: skillPath, action: existed ? "updated" : "added" });
  }
  return results;
}

// ---------------------------------------------------------------------------
// OpenClaw skill format compatibility layer
// ---------------------------------------------------------------------------

export interface OpenClawSkillFile {
  /** Path relative to the skill directory (e.g. "scripts/run.py", "SKILL.md"). */
  path: string;
  content: string;
}

/**
 * A skill in OpenClaw layout: SKILL.md plus any sibling assets (scripts/,
 * reference/, requirements.txt, metadata/...). The bundle is the interchange
 * shape shared by import (OpenClaw -> own) and export (own -> OpenClaw).
 */
export interface OpenClawSkillBundle {
  name: string;
  description: string;
  trigger?: string;
  /** Markdown body of SKILL.md, without frontmatter. */
  body: string;
  /** SKILL.md plus every additional file under the skill directory. */
  files: OpenClawSkillFile[];
}

const OPENCLAW_MAX_FILES = 128;
const OPENCLAW_MAX_FILE_BYTES = 512 * 1024;

function openClawSkillNameFromFrontmatter(data: Record<string, unknown>): string {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  return name;
}

function safeOpenClawSkillName(candidate: string, fallback: string): string {
  const trimmed = candidate.trim();
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed) && trimmed.length <= 64) return trimmed;
  const fromFallback = basename(fallback).trim();
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fromFallback) && fromFallback.length <= 64) return fromFallback;
  return "";
}

function normalizeOpenClawFile(path: string): string {
  return path.split(/[\\/]+/).filter(Boolean).join("/");
}

async function collectOpenClawFiles(dir: string, prefix: string): Promise<OpenClawSkillFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: OpenClawSkillFile[] = [];
  for (const entry of entries) {
    if (files.length >= OPENCLAW_MAX_FILES) break;
    const childPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      files.push(...await collectOpenClawFiles(childPath, prefix ? `${prefix}/${entry.name}` : entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (relativePath.toLowerCase() === "skill.md") continue;
    const bytes = await readFile(childPath);
    if (bytes.byteLength > OPENCLAW_MAX_FILE_BYTES) continue;
    files.push({ path: relativePath, content: bytes.toString("utf8") });
  }
  return files;
}

/**
 * Import a skill from an OpenClaw-layout directory (OpenClaw / agent-skills
 * style: <dir>/SKILL.md plus sibling assets) into the own skill format.
 * The returned bundle carries SKILL.md as `files[0]` and preserves every
 * auxiliary file so the skill can be re-exported losslessly.
 */
export async function openclawImport(skillDirPath: string): Promise<OpenClawSkillBundle> {
  const skillPath = join(skillDirPath, "SKILL.md");
  if (!(await exists(skillPath))) {
    throw new ApiError(404, "skill_not_found", `OpenClaw skill SKILL.md not found in ${skillDirPath}`);
  }
  const content = await readFile(skillPath, "utf8");
  const { data, body } = parseFrontmatter(content);
  const fallbackName = basename(skillDirPath);
  const name = safeOpenClawSkillName(openClawSkillNameFromFrontmatter(data), fallbackName);
  if (!name) {
    throw new ApiError(422, "invalid_skill_name", "OpenClaw skill name must be kebab-case (1-64 chars)");
  }
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const trigger = typeof data.trigger === "string"
    ? data.trigger
    : typeof data.when === "string"
      ? data.when
      : "";
  const additionalFiles = await collectOpenClawFiles(skillDirPath, "");
  return {
    name,
    description,
    ...(trigger ? { trigger: trigger.trim() } : {}),
    body: body.replace(/^\n/, ""),
    files: [
      { path: "SKILL.md", content },
      ...additionalFiles,
    ],
  };
}

/**
 * Convert an own-format skill into the OpenClaw SKILL.md layout. The returned
 * bundle places SKILL.md first (with frontmatter rebuilt for OpenClaw) and
 * keeps any auxiliary files supplied via `extraFiles`.
 */
export function openclawExport(
  ownSkill: {
    name: string;
    description?: string;
    trigger?: string;
    content: string;
    extraFiles?: OpenClawSkillFile[];
  },
): OpenClawSkillBundle {
  const name = ownSkill.name.trim();
  validateSkillName(name);

  const { data, body } = parseFrontmatter(ownSkill.content);
  const frontmatterDescription = typeof data.description === "string" ? data.description.trim() : "";
  const description = (ownSkill.description ?? frontmatterDescription).trim();
  validateDescription(description || undefined);
  const frontmatterData: Record<string, unknown> = {
    ...data,
    name,
    description,
  };
  if (ownSkill.trigger) frontmatterData.trigger = ownSkill.trigger.trim();
  delete frontmatterData.when;
  const frontmatter = buildFrontmatter(frontmatterData);
  const skillBody = body.replace(/^\n/, "");
  const skillMd = `${frontmatter}${skillBody}`.endsWith("\n") ? `${frontmatter}${skillBody}` : `${frontmatter}${skillBody}\n`;

  const files: OpenClawSkillFile[] = [
    { path: "SKILL.md", content: skillMd },
    ...(ownSkill.extraFiles ?? []).map((file) => ({
      path: normalizeOpenClawFile(file.path),
      content: file.content,
    })).filter((file) => file.path && file.path.toLowerCase() !== "skill.md"),
  ];

  return {
    name,
    description,
    ...(ownSkill.trigger ? { trigger: ownSkill.trigger.trim() } : {}),
    body: skillBody,
    files,
  };
}

/**
 * Write an OpenClaw-layout bundle into a directory (directory-level export).
 * Creates the directory and all nested asset paths; SKILL.md is always written.
 */
export async function openclawExportToDir(bundle: OpenClawSkillBundle, targetDir: string): Promise<{ path: string }[]> {
  const written: { path: string }[] = [];
  for (const file of bundle.files) {
    const safePath = normalizeOpenClawFile(file.path);
    if (!safePath || safePath.includes("..")) continue;
    const target = join(targetDir, safePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
    written.push({ path: target });
  }
  if (!written.some((entry) => basename(entry.path).toLowerCase() === "skill.md")) {
    const skillPath = join(targetDir, "SKILL.md");
    await mkdir(targetDir, { recursive: true });
    const skillMd = `${buildFrontmatter({ name: bundle.name, description: bundle.description, ...(bundle.trigger ? { trigger: bundle.trigger } : {}) })}${bundle.body}`;
    await writeFile(skillPath, skillMd.endsWith("\n") ? skillMd : `${skillMd}\n`, "utf8");
    written.push({ path: skillPath });
  }
  return written;
}

/** True when a directory looks like an OpenClaw-layout skill (has SKILL.md). */
export async function isOpenClawSkillDir(dir: string): Promise<boolean> {
  return exists(join(dir, "SKILL.md"));
}

// ---------------------------------------------------------------------------
// 专家-技能打通：按名解析本地 SKILL.md（返回路径/内容）
// ---------------------------------------------------------------------------

/** 按名解析出的技能（含 SKILL.md 全文内容） */
export interface ResolvedSkillContent {
  name: string;
  path: string;
  content: string;
  scope: "project" | "global";
  description: string;
  trigger?: string;
}

/**
 * 按技能名解析到本地 SKILL.md（.opencode/skills、.claude/skills，含域名分组布局）。
 * 未找到返回 null。
 */
export async function resolveSkillByName(
  name: string,
  workspaceRoot: string,
  includeGlobal = true,
): Promise<ResolvedSkillContent | null> {
  const items = await listSkills(workspaceRoot, includeGlobal);
  const item = items.find((s) => s.name === name);
  if (!item) return null;
  const content = await readFile(item.path, "utf8");
  return {
    name: item.name,
    path: item.path,
    content,
    scope: item.scope,
    description: item.description,
    trigger: item.trigger,
  };
}

/**
 * 读取 ExpertDefinition.skills 技能名列表，解析到本地 SKILL.md（返回路径/内容）。
 * 未匹配的技能名被忽略（不抛错）。
 */
export async function resolveExpertSkills(
  skills: string[],
  options: { workspaceRoot: string; includeGlobal?: boolean },
): Promise<ResolvedSkillContent[]> {
  const resolved: ResolvedSkillContent[] = [];
  for (const name of skills) {
    const item = await resolveSkillByName(name, options.workspaceRoot, options.includeGlobal ?? true);
    if (item) resolved.push(item);
  }
  return resolved;
}
