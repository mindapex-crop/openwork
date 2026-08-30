/**
 * 专家-技能打通测试 - skills.ts resolveExpertSkills
 *
 * 验证：按 ExpertDefinition.skills 技能名解析到本地 SKILL.md（返回路径/内容）
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveExpertSkills, resolveSkillByName } from "../skills.js";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "skills-expert-"));
  // 让 findWorkspaceRoots 在此停止向上查找
  await mkdir(join(root, ".git"), { recursive: true });

  // .opencode/skills/<name>/SKILL.md（flat 布局）
  await mkdir(join(root, ".opencode", "skills", "architecture"), { recursive: true });
  await writeFile(
    join(root, ".opencode", "skills", "architecture", "SKILL.md"),
    [
      "---",
      "name: architecture",
      "description: 系统架构设计技能",
      "---",
      "# architecture",
      "输出架构方案。",
      "",
    ].join("\n"),
    "utf8",
  );

  // .claude/skills/<name>/SKILL.md
  await mkdir(join(root, ".claude", "skills", "code-review"), { recursive: true });
  await writeFile(
    join(root, ".claude", "skills", "code-review", "SKILL.md"),
    [
      "---",
      "name: code-review",
      "description: 代码审查技能",
      "---",
      "# code-review",
      "审查代码质量。",
      "",
    ].join("\n"),
    "utf8",
  );

  // 域名分组布局 .opencode/skills/<domain>/<name>/SKILL.md
  await mkdir(join(root, ".opencode", "skills", "web", "react"), { recursive: true });
  await writeFile(
    join(root, ".opencode", "skills", "web", "react", "SKILL.md"),
    [
      "---",
      "name: react",
      "description: React 开发技能",
      "---",
      "# react",
      "编写 React 组件。",
      "",
    ].join("\n"),
    "utf8",
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("resolveSkillByName", () => {
  test("解析存在的技能返回路径与内容", async () => {
    const item = await resolveSkillByName("architecture", root, false);
    expect(item).not.toBeNull();
    expect(item!.name).toBe("architecture");
    expect(item!.path).toContain(".opencode/skills/architecture/SKILL.md");
    expect(item!.content).toContain("输出架构方案");
    expect(item!.scope).toBe("project");
  });

  test("解析不存在的技能返回 null", async () => {
    expect(await resolveSkillByName("no-such-skill", root, false)).toBeNull();
  });

  test("可解析 .claude/skills 布局", async () => {
    const item = await resolveSkillByName("code-review", root, false);
    expect(item).not.toBeNull();
    expect(item!.path).toContain(".claude/skills/code-review/SKILL.md");
    expect(item!.content).toContain("审查代码质量");
  });

  test("可解析域名分组布局", async () => {
    const item = await resolveSkillByName("react", root, false);
    expect(item).not.toBeNull();
    expect(item!.path).toContain("web/react/SKILL.md");
  });
});

describe("resolveExpertSkills", () => {
  test("按技能名列表解析，返回匹配项（未匹配忽略）", async () => {
    const resolved = await resolveExpertSkills(["architecture", "react", "ghost-skill"], {
      workspaceRoot: root,
      includeGlobal: false,
    });
    expect(resolved.map((r) => r.name).sort()).toEqual(["architecture", "react"]);
    for (const r of resolved) {
      expect(r.path).toContain("SKILL.md");
      expect(r.content.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  test("空列表返回空数组", async () => {
    expect(await resolveExpertSkills([], { workspaceRoot: root, includeGlobal: false })).toEqual([]);
  });

  test("专家绑定技能 → 解析结果可直接注入专家上下文", async () => {
    const expert = {
      name: "架构专家",
      skills: ["architecture"],
    };
    const resolved = await resolveExpertSkills(expert.skills, {
      workspaceRoot: root,
      includeGlobal: false,
    });
    expect(resolved.length).toBe(1);
    expect(resolved[0]!.name).toBe("architecture");
    // 技能内容可作为专家 systemPrompt 的补充注入
    const composedPrompt = `${expert.name} 需遵循以下技能：\n\n${resolved[0]!.content}`;
    expect(composedPrompt).toContain("输出架构方案");
  });
});
