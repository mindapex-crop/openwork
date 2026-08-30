import "./_setup/localstorage";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  SKILL_INSTALL_KEY,
  mergedInstalledNames,
  useSkillInstallStore,
} from "../src/react-app/domains/skills/skill-install-store";
import {
  EXPERT_CATEGORIES,
  composeExpertPrompt,
  expertStartSuggestions,
  filterExpertsByCategory,
  normalizeExpertCategory,
} from "../src/react-app/domains/experts/expert-taxonomy";
import type { Expert } from "../src/react-app/domains/experts/types";

function resetInstall() {
  try { globalThis.localStorage.removeItem(SKILL_INSTALL_KEY); } catch {}
  useSkillInstallStore.setState({ installed: {}, inUse: [] });
}

function expert(over: Partial<Expert>): Expert {
  return {
    id: over.id ?? "e1",
    name: over.name ?? "产品经理",
    description: over.description ?? "写 PRD",
    systemPrompt: over.systemPrompt ?? "你是产品经理",
    methodology: over.methodology ?? "",
    skills: over.skills ?? ["plan-tasks"],
    category: over.category,
  };
}

describe("skill-install-store (技能安装态镜像)", () => {
  beforeEach(resetInstall);

  test("markInstalled/isInstalled round-trip", () => {
    expect(useSkillInstallStore.getState().isInstalled("write-article")).toBe(false);
    useSkillInstallStore.getState().markInstalled("write-article");
    expect(useSkillInstallStore.getState().isInstalled("write-article")).toBe(true);
  });

  test("markInstalled is idempotent", () => {
    useSkillInstallStore.getState().markInstalled("a");
    const after = Object.keys(useSkillInstallStore.getState().installed).length;
    useSkillInstallStore.getState().markInstalled("a");
    expect(Object.keys(useSkillInstallStore.getState().installed).length).toBe(after);
  });

  test("markUninstalled removes and clears inUse", () => {
    useSkillInstallStore.getState().markInstalled("a");
    useSkillInstallStore.getState().markInUse("a");
    useSkillInstallStore.getState().markUninstalled("a");
    expect(useSkillInstallStore.getState().isInstalled("a")).toBe(false);
    expect(useSkillInstallStore.getState().inUse).toEqual([]);
  });

  test("mergedInstalledNames unions bridge + mirror", () => {
    useSkillInstallStore.getState().markInstalled("mirror-skill");
    const merged = mergedInstalledNames(["bridge-skill", "mirror-skill"]);
    expect([...merged].sort()).toEqual(["bridge-skill", "mirror-skill"]);
  });
});

describe("expert-taxonomy (专家应用分类 + 召唤提示)", () => {
  test("categories match WorkBuddy chips", () => {
    expect(EXPERT_CATEGORIES).toContain("企业");
    expect(EXPERT_CATEGORIES).toContain("其他");
  });

  test("normalizeExpertCategory defaults unknown to 其他", () => {
    expect(normalizeExpertCategory(undefined)).toBe("其他");
    expect(normalizeExpertCategory("nope")).toBe("其他");
    expect(normalizeExpertCategory("效率")).toBe("效率");
  });

  test("filterExpertsByCategory: 全部 returns all; uncategorized → 其他", () => {
    const list = [expert({ id: "a", category: "效率" }), expert({ id: "b" })];
    expect(filterExpertsByCategory(list, "全部")).toHaveLength(2);
    expect(filterExpertsByCategory(list, "效率").map((e) => e.id)).toEqual(["a"]);
    expect(filterExpertsByCategory(list, "其他").map((e) => e.id)).toEqual(["b"]);
  });

  test("expertStartSuggestions returns 3 non-empty prompts", () => {
    const s = expertStartSuggestions(expert({}));
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.trim().length > 0)).toBe(true);
  });

  test("composeExpertPrompt includes role + task", () => {
    const p = composeExpertPrompt(expert({ name: "产品经理" }), "帮我写一个PRD");
    expect(p).toContain("产品经理");
    expect(p).toContain("帮我写一个PRD");
  });

  test("composeExpertPrompt falls back to a suggestion when no text", () => {
    const p = composeExpertPrompt(expert({ name: "架构评审专家" }), "   ");
    expect(p.includes("架构评审专家")).toBe(true);
    expect(p.trim().length > 0).toBe(true);
  });
});
