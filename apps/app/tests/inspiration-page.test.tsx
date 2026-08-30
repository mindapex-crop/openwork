/**
 * Inspiration 域 —— 内置组合包数据完整性、打包/解包纯逻辑与"做同款"创建专家失败兜底。
 */
import { describe, expect, test } from "bun:test";

import {
  buildExpertInputFromPack,
  createExpertFromPack,
  INSPIRATION_PACKS,
  packPromptForSession,
} from "../src/react-app/domains/inspiration/inspiration-store";
import { SKILL_CATALOG } from "../src/react-app/domains/skills/skill-catalog";

describe("内置灵感组合包数据完整性", () => {
  test("组合包数量在 4-6 之间", () => {
    expect(INSPIRATION_PACKS.length).toBeGreaterThanOrEqual(4);
    expect(INSPIRATION_PACKS.length).toBeLessThanOrEqual(6);
  });

  test("组合包 id 唯一，且 title/description/prompt 非空", () => {
    const ids = new Set(INSPIRATION_PACKS.map((pack) => pack.id));
    expect(ids.size).toBe(INSPIRATION_PACKS.length);
    for (const pack of INSPIRATION_PACKS) {
      expect(pack.id.length).toBeGreaterThan(0);
      expect(pack.title.trim().length).toBeGreaterThan(0);
      expect(pack.description.trim().length).toBeGreaterThan(0);
      expect(pack.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  test("组合包引用的 skills 都存在于本地技能目录（id 或 name 命中）", () => {
    const catalogIds = new Set(SKILL_CATALOG.map((entry) => entry.id));
    const catalogNames = new Set(SKILL_CATALOG.map((entry) => entry.name));
    for (const pack of INSPIRATION_PACKS) {
      for (const skill of pack.skills) {
        expect(
          catalogIds.has(skill) || catalogNames.has(skill),
          `${pack.id} 引用了不存在的技能 ${skill}`,
        ).toBe(true);
      }
    }
  });
});

describe("做同款 —— 组合包到会话/专家的转换逻辑", () => {
  const pack = INSPIRATION_PACKS[0];

  test("packPromptForSession 返回可直接注入会话的 prompt", () => {
    const prompt = packPromptForSession(pack);
    expect(prompt).toBe(pack.prompt);
    expect(prompt.length).toBeGreaterThan(0);
  });

  test("buildExpertInputFromPack 生成合法的 ExpertInput（name/systemPrompt/methodology/skills 齐全）", () => {
    const input = buildExpertInputFromPack(pack);
    expect(input.name.trim().length).toBeGreaterThan(0);
    expect(input.systemPrompt.trim().length).toBeGreaterThan(0);
    expect(typeof input.methodology).toBe("string");
    expect(Array.isArray(input.skills)).toBe(true);
    expect(input.skills).toContain(pack.skills[0]);
  });

  test("createExpertFromPack 成功时返回 ok:true 且调用 POST /api/experts", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ expert: { id: "ex-from-pack", name: input } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await createExpertFromPack(pack);
    expect(result.ok).toBe(true);
    expect(capturedUrl).toBe("/api/experts");
    expect(JSON.parse(capturedBody).skills).toEqual(pack.skills);
  });

  test("createExpertFromPack 后端失败时返回 ok:false 与错误信息（页面据此提示）", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "experts api unavailable" }), { status: 503 })) as typeof fetch;

    const result = await createExpertFromPack(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
