import type { Expert } from "./types";

/** WorkBuddy 专家应用一级分类（对齐参考截图顶部分类 chips）。 */
export const EXPERT_CATEGORIES = [
  "企业",
  "日常",
  "学习",
  "效率",
  "自媒体",
  "电商",
  "其他",
] as const;

export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];

export const DEFAULT_EXPERT_CATEGORY: ExpertCategory = "其他";

export function normalizeExpertCategory(category: string | undefined): ExpertCategory {
  return (EXPERT_CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as ExpertCategory)
    : DEFAULT_EXPERT_CATEGORY;
}

/**
 * 按分类过滤专家（纯逻辑，可测）。category 为空/"全部" 时返回全部。
 * 未分类的专家归入 "其他"，保证过滤始终有结果。
 */
export function filterExpertsByCategory(experts: readonly Expert[], category: string): Expert[] {
  if (!category || category === "全部") return [...experts];
  return experts.filter((expert) => normalizeExpertCategory(expert.category) === category);
}

/** 详情弹窗 "开始任务" 的 3 条建议提示（纯函数，可测）。 */
export function expertStartSuggestions(expert: Expert): string[] {
  const focus = expert.name || "这项任务";
  return [
    `我想用「${focus}」开始一个新任务，请引导我梳理目标和步骤。`,
    `${expert.description ? expert.description + "。" : ""}请给出可执行的方案。`,
    `帮我以「${focus}」的视角评审当前进展并给出下一步建议。`,
  ];
}

/**
 * 组装发给真实会话的提示：把专家身份 + systemPrompt 前缀进用户指令，
 * 使被召唤的专家以其方法执行任务。
 */
export function composeExpertPrompt(expert: Expert, userText: string): string {
  const role = `请以「${expert.name}」的身份与方法协助我。`;
  const method = expert.methodology ? `\n工作方法：${expert.methodology}` : "";
  const task = userText.trim() || expertStartSuggestions(expert)[0];
  return `${role}${method}\n\n任务：${task}`.trim();
}
