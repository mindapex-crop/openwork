/**
 * 八大模块侧边栏导航（WorkBuddy 对标）。
 *
 * 命名基准：助理/专家/技能/连接器/资料库/自动化/项目/灵感
 *           Assistant/Experts/Skills/Connectors/Library/Automations/Projects/Inspiration
 *
 * 每一项都必须对应 session-route.tsx 真实渲染的模块页；没有面板的入口只会命中兜底跳转。
 * 所有文案都走 i18n key（sidebar.*），侧边栏渲染处不允许出现硬编码英文。
 */
export const SIDEBAR_NAV_ITEMS = [
  { id: "assistant", i18nKey: "sidebar.assistant", route: "/session" },
  { id: "plans", i18nKey: "sidebar.plans", route: "/plans" },
  { id: "experts", i18nKey: "sidebar.experts", route: "/experts" },
  { id: "skills", i18nKey: "sidebar.skills", route: "/skills" },
  { id: "connectors", i18nKey: "sidebar.connectors", route: "/connectors" },
  { id: "library", i18nKey: "sidebar.library", route: "/library" },
  { id: "automations", i18nKey: "sidebar.automations", route: "/automations" },
  { id: "projects", i18nKey: "sidebar.projects", route: "/projects" },
  { id: "inspiration", i18nKey: "sidebar.inspiration", route: "/inspiration" },
] as const;

export type SidebarNavId = (typeof SIDEBAR_NAV_ITEMS)[number]["id"];

/** 与 shell/session-route.tsx 的路由注册保持一致的路由正则（用于 active 高亮）。 */
export const SIDEBAR_NAV_ROUTE_REGEXES: Record<SidebarNavId, RegExp> = {
  assistant: /^\/session(?:\/|$)|^\/workspace\/[^/]+\/session(?:\/|$)/,
  plans: /^\/plans(?:\/|$)/,
  experts: /^\/experts(?:\/|$)/,
  skills: /^\/skills(?:\/|$)/,
  connectors: /^\/connectors(?:\/|$)/,
  library: /^\/library(?:\/|$)/,
  automations: /^\/automations(?:\/|$)/,
  projects: /^\/projects(?:\/|$)/,
  inspiration: /^\/inspiration(?:\/|$)/,
};

/** 不是侧栏入口、但同样占据主区的模块路由。 */
export const SIDEBAR_MODULE_ROUTE_REGEXES = {
  collab: /^\/collab-hub(?:\/|$)/,
  marketplace: /^\/marketplace(?:\/|$)/,
} as const;
