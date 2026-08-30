import { describe, expect, test } from "bun:test";

import { t } from "../src/i18n";
import {
  SIDEBAR_NAV_ITEMS,
  SIDEBAR_NAV_ROUTE_REGEXES,
} from "../src/react-app/domains/session/sidebar/sidebar-nav";

// WorkBuddy 对标九大模块：助理/计划/专家/技能/连接器/资料库/自动化/项目/灵感
// Assistant/Plans/Experts/Skills/Connectors/Library/Automations/Projects/Inspiration
describe("九大模块侧边栏（sidebar-nav）", () => {
  test("正好 9 个导航项，顺序为 助理/计划/专家/技能/连接器/资料库/自动化/项目/灵感", () => {
    expect(SIDEBAR_NAV_ITEMS).toHaveLength(9);
    expect(SIDEBAR_NAV_ITEMS.map((item) => item.id)).toEqual([
      "assistant",
      "plans",
      "experts",
      "skills",
      "connectors",
      "library",
      "automations",
      "projects",
      "inspiration",
    ]);
  });

  test("每个导航项都走 i18n key（sidebar.*）且中英文文案均已配置", () => {
    const expectedKeys = [
      "sidebar.assistant",
      "sidebar.plans",
      "sidebar.experts",
      "sidebar.skills",
      "sidebar.connectors",
      "sidebar.library",
      "sidebar.automations",
      "sidebar.projects",
      "sidebar.inspiration",
    ];
    for (const item of SIDEBAR_NAV_ITEMS) {
      expect(item.i18nKey).toMatch(/^sidebar\./);
      expect(expectedKeys).toContain(item.i18nKey);
      // t() 缺失时回退到 key 本身；en/zh 都应有真实文案。
      expect(t(item.i18nKey, "en")).not.toBe(item.i18nKey);
      expect(t(item.i18nKey, "zh")).not.toBe(item.i18nKey);
    }
  });

  test("中文文案符合命名基准（助理/计划/专家/技能/连接器/资料库/自动化/项目/灵感）", () => {
    const zhLabels = Object.fromEntries(SIDEBAR_NAV_ITEMS.map((item) => [item.id, t(item.i18nKey, "zh")]));
    expect(zhLabels.assistant).toBe("助理");
    expect(zhLabels.plans).toBe("计划");
    expect(zhLabels.experts).toBe("专家");
    expect(zhLabels.skills).toBe("技能");
    expect(zhLabels.connectors).toBe("连接器");
    expect(zhLabels.library).toBe("资料库");
    expect(zhLabels.automations).toBe("自动化");
    expect(zhLabels.projects).toBe("项目");
    expect(zhLabels.inspiration).toBe("灵感");
  });

  test("导航项不包含硬编码英文标签", () => {
    const raw = SIDEBAR_NAV_ITEMS.map((item) => item.i18nKey).join(" ");
    expect(raw).not.toMatch(/Automations|Projects|Skills|Knowledge|Marketplace|Collab/);
    expect(raw).not.toMatch(/^[A-Z][a-z]+$/);
  });

  test("每个导航项都有路由正则，且匹配自身路由、拒绝无关路径", () => {
    for (const item of SIDEBAR_NAV_ITEMS) {
      expect(SIDEBAR_NAV_ROUTE_REGEXES[item.id]).toBeInstanceOf(RegExp);
      expect(SIDEBAR_NAV_ROUTE_REGEXES[item.id].test(item.route)).toBe(true);
    }
    // 新注册路由
    expect(SIDEBAR_NAV_ROUTE_REGEXES.experts.test("/experts")).toBe(true);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.experts.test("/session")).toBe(false);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.connectors.test("/connectors")).toBe(true);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.connectors.test("/skills")).toBe(false);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.library.test("/library")).toBe(true);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.library.test("/knowledge")).toBe(false);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.inspiration.test("/inspiration")).toBe(true);
    expect(SIDEBAR_NAV_ROUTE_REGEXES.inspiration.test("/projects")).toBe(false);
  });
});
