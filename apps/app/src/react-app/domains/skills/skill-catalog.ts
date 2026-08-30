/**
 * 技能与 Agent 广场 —— 精选技能目录（纯前端内置数据，无后端依赖）。
 *
 * 字段与 OpenWork 真实 skill 概念对齐（name / description / category）：
 * - name        技能名，对应 SKILL.md 中 frontmatter 的 `name`，也是斜杠命令的 slug。
 * - description 一句话说明技能用途。
 * - category    面向普通用户的中文分类（写作 / 数据分析 / 编程 / 办公 / 研究）。
 * - tags        额外标签，用于搜索命中与展示。
 * - suggestedTool 可选的关联工具提示（如 spreadsheet / browser / claude-skill）。
 */

export type SkillCategory = "写作" | "数据分析" | "编程" | "办公" | "研究";

export type SkillEntry = {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  /** 可选：该技能倾向使用的工具/Agent，用于"使用方式"提示。 */
  suggestedTool?: string;
};

export const SKILL_CATEGORIES: readonly SkillCategory[] = [
  "写作",
  "数据分析",
  "编程",
  "办公",
  "研究",
];

/** 内置精选技能目录。数据为静态内置，帮助普通用户在本地安装/使用对应 skill。 */
export const SKILL_CATALOG: readonly SkillEntry[] = [
  {
    id: "writing-article",
    name: "write-article",
    description: "从选题大纲到成稿，一站式产出公众号 / 博客长文与结构化草稿。",
    category: "写作",
    tags: ["公众号", "博客", "大纲", "种草", "prompt"],
  },
  {
    id: "writing-editing",
    name: "edit-article",
    description: "重构文章段落、打磨措辞与逻辑，让已有的草稿更加清晰有力。",
    category: "写作",
    tags: ["编辑", "润色", "重构", "清晰度"],
  },
  {
    id: "writing-repurposer",
    name: "repurpose-content",
    description: "一鱼多吃：把一篇文章改写成小红书 / 知乎 / 推特等不同平台版本。",
    category: "写作",
    tags: ["小红书", "知乎", "跨平台", "改编"],
  },
  {
    id: "writing-publisher",
    name: "publish-content",
    description: "将文章适配到微信 / 知乎 / 掘金等多个平台，并一键发布。",
    category: "写作",
    tags: ["发布", "多平台", "适配", "排版"],
  },
  {
    id: "data-analysis",
    name: "analyze-data",
    description: "分析表格 / CSV 数据，提取指标、对比趋势并生成可读结论。",
    category: "数据分析",
    tags: ["Excel", "CSV", "图表", "指标", "趋势"],
    suggestedTool: "spreadsheet",
  },
  {
    id: "data-viz",
    name: "chart-designer",
    description: "根据数据语义自动选择合适的图表类型并输出可视化排版建议。",
    category: "数据分析",
    tags: ["可视化", "图表", "设计", "dashboard"],
  },
  {
    id: "data-reporter",
    name: "content-analytics",
    description: "复盘内容表现，拆解阅读量与互动数据，生成优化建议清单。",
    category: "数据分析",
    tags: ["复盘", "阅读量", "效果", "优化"],
  },
  {
    id: "code-review",
    name: "review-code",
    description: "以代码评审视角检查改动，定位问题并给出可落地的修改建议。",
    category: "编程",
    tags: ["review", "code quality", "diff", "最佳实践"],
    suggestedTool: "claude-code",
  },
  {
    id: "code-diag",
    name: "diagnose-bug",
    description: "按复现 → 最小化 → 假设 → 修复 → 回归 的流程围堵疑难 Bug。",
    category: "编程",
    tags: ["debug", "bug", "复现", "回归"],
  },
  {
    id: "code-testing",
    name: "write-tests",
    description: "为功能编写 TDD 风格测试，覆盖正常与边界路径并保持可维护。",
    category: "编程",
    tags: ["test", "TDD", "vitest", "jest"],
  },
  {
    id: "office-summary",
    name: "summarize-meeting",
    description: "把会议记录 / 音频转写整理成结论、待办与决策要点的结构化摘要。",
    category: "办公",
    tags: ["会议", "摘要", "待办", "纪要"],
  },
  {
    id: "office-email",
    name: "draft-email",
    description: "基于要点起草得体、清晰的商务邮件或对内通知，自动控制语气与篇幅。",
    category: "办公",
    tags: ["邮件", "通知", "商务", "语气"],
  },
  {
    id: "office-todo",
    name: "plan-tasks",
    description: "把零散想法整理成分步任务清单，拆分优先级并给出时间规划建议。",
    category: "办公",
    tags: ["任务", "规划", "todo", "优先级"],
  },
  {
    id: "research-paper",
    name: "paper-research",
    description: "检索并阅读论文，提炼方法、结论与创新点，输出研究综述要点。",
    category: "研究",
    tags: ["论文", "arxiv", "综述", "文献"],
  },
  {
    id: "research-topic",
    name: "topic-analyzer",
    description: "分析某主题 / 竞品 / 账号的内容策略，形成可执行的分析报告。",
    category: "研究",
    tags: ["主题", "竞品", "分析", "报告"],
  },
  {
    id: "research-web",
    name: "web-research",
    description: "联网检索并整理某话题的多方信息，交叉核对后给出带来源的结论。",
    category: "研究",
    tags: ["搜索", "联网", "来源", "事实核查"],
    suggestedTool: "browser",
  },
];

/** 技能名即斜杠命令 slug，统一由 name 派生，避免与前端展示文案不一致。 */
export function skillCommandSlug(entry: Pick<SkillEntry, "name">): string {
  return `/skill ${entry.name}`;
}

export type SkillFilter = {
  /** 完整或按空格拆分的多关键词，命中 name / description / tags / category 任一。 */
  query?: string;
  category?: SkillCategory | "全部";
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(entry: SkillEntry, terms: string[]): boolean {
  const haystack = normalize(
    [entry.name, entry.description, entry.category, ...entry.tags].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

/** 按关键词与分类过滤目录，返回排序不变的新数组。 */
export function filterSkills(
  entries: readonly SkillEntry[],
  filter: SkillFilter,
): SkillEntry[] {
  const terms = normalize(filter.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return entries.filter((entry) => {
    const categoryMatch = !filter.category || filter.category === "全部" || entry.category === filter.category;
    return categoryMatch && matchesQuery(entry, terms);
  });
}

/** 关键词搜索的便捷封装。 */
export function searchSkills(entries: readonly SkillEntry[], query: string): SkillEntry[] {
  return filterSkills(entries, { query });
}

/** 某个分类下的条目数，用于分类 tab 的角标展示。 */
export function categoryCount(
  entries: readonly SkillEntry[],
  category: SkillCategory,
): number {
  return entries.filter((entry) => entry.category === category).length;
}

/**
 * 由目录条目生成可直接写入本地技能目录（.opencode/skills/<name>/SKILL.md）的
 * 模板内容：frontmatter（name/description）+ 可执行的指令正文。
 * 用于"技能广场一键安装"。
 */
export function buildSkillMarkdown(entry: Pick<SkillEntry, "name" | "description" | "suggestedTool">): string {
  const toolHint = entry.suggestedTool
    ? `\n- 优先配合 ${entry.suggestedTool} 相关工具使用，效果最佳。`
    : "";
  return `---
name: ${entry.name}
description: ${entry.description}
---

# Skill: ${entry.name}

${entry.description}

## 使用方式

- 用户提出相关任务时，直接按本技能说明执行。
- 若缺少必要上下文，先向用户澄清目标与输入。${toolHint}
- 完成输出时保持结构化、可直接使用的形式。
`;
}