/**
 * 技能目录 —— SKILL.md 模板生成（用于"技能广场一键安装到本地技能目录"）。
 */
import { describe, expect, test } from "bun:test";

import { SKILL_CATALOG, buildSkillMarkdown } from "../src/react-app/domains/skills/skill-catalog";

describe("buildSkillMarkdown —— 由目录条目生成合规的 SKILL.md", () => {
  const entry = SKILL_CATALOG[0];

  test("frontmatter 含 name 与 description，且与条目一致", () => {
    const markdown = buildSkillMarkdown(entry);
    expect(markdown).toContain(`name: ${entry.name}`);
    expect(markdown).toContain(`description: ${entry.description}`);
    expect(markdown).toMatch(/^---\n/);
  });

  test("正文包含描述与使用引导，可被 agent 直接加载", () => {
    const markdown = buildSkillMarkdown(entry);
    expect(markdown).toContain(`# Skill: ${entry.name}`);
    expect(markdown).toContain(entry.description);
    expect(markdown.length).toBeGreaterThan(100);
  });

  test("目录中每个条目都能生成非空且命名安全的技能模板", () => {
    for (const item of SKILL_CATALOG) {
      const markdown = buildSkillMarkdown(item);
      expect(markdown.trim().length).toBeGreaterThan(0);
      // 安装目录名即 skill.name：不得含路径分隔符或空白，避免注入/非法目录
      expect(item.name).toMatch(/^[a-z0-9][a-z0-9-_]*$/i);
    }
  });
});
