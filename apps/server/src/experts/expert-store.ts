/**
 * Expert Store - 专家定义存储（文件式）
 *
 * 参考 agent-store.ts 的 .md + YAML frontmatter 模式：
 * - 每个专家一个目录：<expertsDir>/<id>/expert.md
 * - frontmatter 存元数据（name/description/methodology/model/avatar/agent/role/skills/...）
 * - 正文（body）为 systemPrompt
 *
 * 支持：CRUD、专家 → AgentTeamMember 转换。
 */

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSidecarAdapter } from "../agent-sidecar/types.js";
import type {
  ExpertCreateInput,
  ExpertDefinition,
  ExpertUpdateInput,
} from "./types.js";

// Re-export 类型（store 模块作为 experts 的默认入口）
export type { ExpertCreateInput, ExpertUpdateInput, ExpertDefinition } from "./types.js";

const EXPERT_FILE = "expert.md";

export class ExpertStore {
  private expertsDir: string;

  constructor(expertsDir: string) {
    this.expertsDir = expertsDir;
  }

  async init(): Promise<void> {
    try {
      await mkdir(this.expertsDir, { recursive: true });
    } catch {
      // already exists
    }
  }

  async list(): Promise<ExpertDefinition[]> {
    await this.init();
    const entries = await readdir(this.expertsDir, { withFileTypes: true });
    const experts: ExpertDefinition[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = join(this.expertsDir, entry.name, EXPERT_FILE);
      try {
        const content = await readFile(filePath, "utf-8");
        const expert = this.parseExpert(content, entry.name);
        experts.push({ ...expert, path: filePath });
      } catch {
        // skip directories without expert.md
      }
    }

    return experts.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<ExpertDefinition | null> {
    await this.init();
    const filePath = join(this.expertsDir, id, EXPERT_FILE);
    try {
      const content = await readFile(filePath, "utf-8");
      return { ...this.parseExpert(content, id), path: filePath };
    } catch {
      return null;
    }
  }

  async create(input: ExpertCreateInput): Promise<ExpertDefinition> {
    await this.init();
    const id = this.slugify(input.name);
    const now = new Date().toISOString();

    const expert: ExpertDefinition = {
      id,
      name: input.name,
      description: input.description ?? "",
      systemPrompt: input.systemPrompt,
      methodology: input.methodology ?? "",
      skills: input.skills ?? [],
      model: input.model,
      avatar: input.avatar,
      agentId: input.agentId ?? id,
      role: input.role,
      createdAt: now,
      updatedAt: now,
      source: "local",
    };

    const content = this.serializeExpert(expert);
    const expertDir = join(this.expertsDir, id);
    await mkdir(expertDir, { recursive: true });
    const filePath = join(expertDir, EXPERT_FILE);
    await writeFile(filePath, content, "utf-8");

    return { ...expert, path: filePath };
  }

  async update(id: string, input: ExpertUpdateInput): Promise<ExpertDefinition | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    // 若更新了名称且名称 slug 变化，迁移目录（保持 id 与名称一致）
    const nextName = input.name ?? existing.name;
    const nextId = this.slugify(nextName);
    const updated: ExpertDefinition = {
      ...existing,
      id: nextId,
      name: nextName,
      description: input.description ?? existing.description,
      systemPrompt: input.systemPrompt ?? existing.systemPrompt,
      methodology: input.methodology ?? existing.methodology,
      skills: input.skills ?? existing.skills,
      model: input.model ?? existing.model,
      avatar: input.avatar ?? existing.avatar,
      agentId: input.agentId ?? existing.agentId,
      role: input.role ?? existing.role,
      updatedAt: new Date().toISOString(),
    };

    if (nextId !== id) {
      const oldDir = join(this.expertsDir, id);
      const newDir = join(this.expertsDir, nextId);
      await mkdir(newDir, { recursive: true });
      try {
        await rm(newDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      try {
        const { rename } = await import("node:fs/promises");
        await rename(oldDir, newDir);
      } catch {
        // 目录迁移失败则写新位置（旧目录保留，可接受）
      }
    }

    const content = this.serializeExpert(updated);
    const filePath = join(this.expertsDir, nextId, EXPERT_FILE);
    await writeFile(filePath, content, "utf-8");

    return { ...updated, path: filePath };
  }

  async delete(id: string): Promise<boolean> {
    const expert = await this.get(id);
    if (!expert) return false;
    try {
      await rm(join(this.expertsDir, id), { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  /** 专家 → AgentTeamMember（adapter 由调用方注入，如 createAdapterForAgent） */
  toTeamMember(expert: ExpertDefinition, adapter: AgentSidecarAdapter) {
    return {
      agentId: expert.agentId,
      adapter,
      role: expert.role,
    };
  }

  // ---------- 解析与序列化 ----------

  private parseExpert(content: string, id: string): ExpertDefinition {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let metadata: Record<string, unknown> = {};
    let frontmatterName: string | undefined;
    let frontmatterDesc: string | undefined;

    let body = content;
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      body = content.slice(frontmatterMatch[0].length);
      metadata = this.parseFrontmatter(frontmatter);
      frontmatterName = this.asString(metadata.name);
      frontmatterDesc = this.asString(metadata.description);
    }

    const systemPrompt = body.trim();
    const name = frontmatterName ?? id;
    const description = frontmatterDesc ?? "";

    return {
      id,
      name,
      description,
      systemPrompt,
      methodology: this.asString(metadata.methodology) ?? "",
      skills: this.asStringArray(metadata.skills),
      model: this.asString(metadata.model) ?? undefined,
      avatar: this.asString(metadata.avatar) ?? undefined,
      agentId: this.asString(metadata.agent) ?? id,
      role: this.asRole(metadata.role),
      createdAt: this.asString(metadata.created_at) ?? new Date().toISOString(),
      updatedAt: this.asString(metadata.updated_at) ?? new Date().toISOString(),
      source: "local",
    };
  }

  private serializeExpert(expert: ExpertDefinition): string {
    const lines: string[] = ["---"];
    lines.push(`name: ${expert.name}`);
    if (expert.description) {
      lines.push(`description: ${expert.description}`);
    }
    if (expert.methodology) {
      lines.push(`methodology: ${expert.methodology}`);
    }
    if (expert.model) {
      lines.push(`model: ${expert.model}`);
    }
    if (expert.avatar) {
      lines.push(`avatar: ${expert.avatar}`);
    }
    lines.push(`agent: ${expert.agentId}`);
    if (expert.role) {
      lines.push(`role: ${expert.role}`);
    }
    if (expert.skills.length > 0) {
      lines.push("skills:");
      for (const skill of expert.skills) {
        lines.push(`  - ${skill}`);
      }
    }
    lines.push(`created_at: ${expert.createdAt}`);
    lines.push(`updated_at: ${expert.updatedAt}`);
    lines.push("---");
    lines.push("");
    lines.push(expert.systemPrompt);
    lines.push("");
    return lines.join("\n");
  }

  private parseFrontmatter(frontmatter: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = frontmatter.split("\n");
    let currentKey: string | null = null;
    let isMultilineArray = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (isMultilineArray && trimmed.startsWith("- ")) {
        const list = result[currentKey!] as string[] | undefined;
        if (Array.isArray(list)) list.push(trimmed.slice(2));
        continue;
      }
      if (trimmed.startsWith("- ") && currentKey && !isMultilineArray) {
        const list = result[currentKey] as string[] | undefined;
        if (Array.isArray(list)) list.push(trimmed.slice(2));
        continue;
      }
      const kvMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1];
        const value = kvMatch[2] || "";
        if (!value || value === "[]") {
          result[currentKey] = [];
          isMultilineArray = true;
        } else {
          const arrayMatch = value.match(/^\[(.*)\]$/);
          if (arrayMatch) {
            result[currentKey] = arrayMatch[1]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            isMultilineArray = false;
          } else {
            result[currentKey] = value;
            isMultilineArray = false;
          }
        }
        continue;
      }
      // multi-line string continuation（简单拼接）
      if (currentKey && trimmed && !kvMatch) {
        const existing = result[currentKey];
        if (typeof existing === "string") {
          result[currentKey] = existing + " " + trimmed;
        }
      }
    }
    return result;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
    if (typeof value === "string" && value) return [value];
    return [];
  }

  private asRole(value: unknown): ExpertDefinition["role"] {
    if (typeof value !== "string") return undefined;
    const roles: NonNullable<ExpertDefinition["role"]>[] = [
      "primary",
      "reviewer",
      "fallback",
      "specialist",
      "observer",
      "synthesizer",
    ];
    return roles.includes(value as never) ? (value as NonNullable<ExpertDefinition["role"]>) : undefined;
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "expert"
    );
  }
}
