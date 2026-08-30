/**
 * 灵感组合包数据与"做同款"逻辑。
 *
 * INSPIRATION_PACKS 为内置示例组合包（Prompt + Skill + 专家配置），
 * 不依赖后端。创建专家走 /api/experts POST（experts-store，已联调）。
 */

import { useExpertsStore } from "../experts/experts-store";
import { buildExpertInputFromPack, type ExpertFromPackResult, type InspirationPack } from "./types";

export { buildExpertInputFromPack } from "./types";

export const INSPIRATION_PACKS: readonly InspirationPack[] = [
  {
    id: "weekly-report",
    title: "周报助手",
    description: "把一周的工作散点整理成结构清晰、重点突出的周报。",
    category: "workflow",
    prompt:
      "你是我的周报助手。请根据我提供的本周工作要点（任务、进展、问题、数据），产出一份结构化周报：\n1. 本周完成（按项目/模块分组）\n2. 关键进展与数据\n3. 遇到的问题与风险\n4. 下周计划\n要求：重点前置、措辞简洁、可直接粘贴到周报系统。",
    skills: ["office-summary", "office-todo"],
    tags: ["周报", "总结", "办公"],
  },
  {
    id: "code-review-expert",
    title: "代码审查专家",
    description: "以资深评审视角检查代码改动，输出可落地的修改建议。",
    category: "expert",
    prompt:
      "你是一名资深代码审查专家。请以 diff 为输入，按以下维度逐项审查：\n1. 正确性：边界条件、并发、错误处理\n2. 可维护性：命名、抽象、复杂度\n3. 性能与安全\n4. 测试覆盖\n每条问题给出：严重级别、原因、具体修改建议。结论用列表输出。",
    skills: ["code-review", "code-testing"],
    tags: ["review", "code quality", "diff"],
    expertTemplate: {
      name: "代码审查专家",
      description: "以资深评审视角检查代码改动，输出可落地的修改建议。",
      methodology: "先通读 diff，再按 正确性 → 可维护性 → 性能与安全 → 测试覆盖 逐项评审，最后汇总严重级别与建议。",
      model: "deepseek-coder",
    },
  },
  {
    id: "product-requirement-breakdown",
    title: "产品需求拆解",
    description: "把模糊的产品诉求拆成可执行的用户故事与验收标准。",
    category: "workflow",
    prompt:
      "你是产品需求拆解助手。请把以下产品诉求拆解为：\n1. 目标与背景\n2. 用户故事（As a / I want / So that）\n3. 验收标准（Given/When/Then）\n4. 边界与异常场景\n5. 依赖与开放问题\n请保持条目化，便于直接进入研发排期。",
    skills: ["research-topic", "office-todo"],
    tags: ["需求", "PRD", "拆解"],
  },
  {
    id: "meeting-notes",
    title: "会议纪要整理",
    description: "把会议记录/转写整理成结论、待办与决策要点的结构化纪要。",
    category: "workflow",
    prompt:
      "你是会议纪要助手。请把提供的会议记录/转写整理成结构化纪要：\n1. 会议主题与参与人\n2. 关键结论与决策\n3. 待办事项（负责人 + 截止时间）\n4. 遗留问题\n要求：剔除口头废话，只保留信息量，待办用可勾选列表。",
    skills: ["office-summary"],
    tags: ["会议", "纪要", "待办"],
  },
  {
    id: "data-analysis-report",
    title: "数据分析报告",
    description: "从表格/CSV 数据中提取指标、对比趋势并生成可读结论。",
    category: "workflow",
    prompt:
      "你是数据分析助手。请基于提供的表格/CSV 数据输出：\n1. 数据概览（规模、口径、异常值）\n2. 关键指标与趋势\n3. 对比与洞察（涨跌原因假设）\n4. 可视化建议（图表类型与维度）\n5. 下一步建议\n结论需区分事实与推断。",
    skills: ["data-analysis", "data-viz"],
    tags: ["Excel", "指标", "趋势"],
  },
  {
    id: "content-polish",
    title: "内容润色大师",
    description: "重构文章段落、打磨措辞与逻辑，让草稿更清晰有力。",
    category: "expert",
    prompt:
      "你是一名资深内容编辑。请对提供的草稿进行润色：\n1. 保持原意，重构啰嗦段落\n2. 优化开头与结尾的吸引力\n3. 统一语气与用词\n4. 输出修改说明（改了什么、为什么）\n直接输出润色后的全文，再附修改要点列表。",
    skills: ["writing-editing", "writing-article"],
    tags: ["润色", "编辑", "写作"],
    expertTemplate: {
      name: "内容润色大师",
      description: "重构文章段落、打磨措辞与逻辑，让草稿更清晰有力。",
      methodology: "先通读把握主旨，再逐段重构：标题 → 开头 → 正文 → 结尾，最后统一语气并输出修改说明。",
    },
  },
];

/** 取组合包用于新会话的 prompt 文本。 */
export function packPromptForSession(pack: InspirationPack): string {
  return pack.prompt;
}

/**
 * 做同款 —— 一键创建专家：构建 ExpertInput 并调用 /api/experts POST。
 * 后端不可用时返回 ok:false + 错误信息，由页面提示。
 */
export async function createExpertFromPack(pack: InspirationPack): Promise<ExpertFromPackResult> {
  try {
    const created = await useExpertsStore.getState().createExpert(buildExpertInputFromPack(pack));
    if (!created) {
      return { ok: false, error: "expert create returned no expert" };
    }
    return { ok: true, expertId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
