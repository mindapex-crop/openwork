/**
 * 伪造指标回归防线（对标升级 PR-2）
 *
 * 这几处曾把编造出来的数字渲染给用户：专家使用量 1,828,300、灵感包「N 人用了同款」
 * 的伪随机数、资料库 5 GB 容量条（任务数 × 0.12）、账号菜单「积分 · 2,580」。
 * 它们都没有数据源，接不到真数据就只能删掉控件，所以这里钉住不再回来。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const sources: Array<{ label: string; file: string }> = [
  { label: "expert card", file: "../src/react-app/domains/experts/expert-card.tsx" },
  { label: "expert detail modal", file: "../src/react-app/domains/experts/expert-detail-modal.tsx" },
  { label: "experts page", file: "../src/react-app/domains/experts/experts-page.tsx" },
  { label: "inspiration page", file: "../src/react-app/domains/inspiration/inspiration-page.tsx" },
  { label: "project detail panel", file: "../src/react-app/domains/projects/project-detail-panel.tsx" },
  { label: "account status menu", file: "../src/react-app/domains/session/sidebar/account-status-menu.tsx" },
];

function read(file: string): string {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
}

function sourceOf(label: string): string {
  const entry = sources.find((source) => source.label === label);
  if (!entry) throw new Error(`no source registered for "${label}"`);
  return read(entry.file);
}

const banned = [
  "1828300",
  "次使用",
  "inspiration.actions.useSame",
  "usedGB",
  "capacityPercent",
  "projects.capacity_",
  "积分 ·",
  "成长计划",
];

describe("no invented metrics reach the UI", () => {
  for (const { label, file } of sources) {
    test(`${label} has no fabricated numbers`, () => {
      const source = read(file);
      const hits = banned.filter((needle) => source.includes(needle));
      expect(hits).toEqual([]);
    });
  }

  test("inspiration cards derive no usage count from skill/tag counts", () => {
    expect(sourceOf("inspiration page")).not.toMatch(/%\s*900\s*\+\s*100/);
  });

  test("account menu renders credits only from the Den balance", () => {
    const source = sourceOf("account status menu");
    expect(source).toContain("getCreditsBalance");
    expect(source).toMatch(/signedIn && credits/);
  });
});
