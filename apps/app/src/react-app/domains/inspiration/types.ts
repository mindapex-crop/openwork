/**
 * 灵感（Inspiration）领域类型。
 *
 * 灵感 = Prompt + Skill + 专家配置的组合包：
 * - 支持"做同款"：把组合包一键应用到新会话（prompt），或一键创建专家
 *   （调用 /api/experts POST，见 experts-store）。
 */

import type { ExpertInput } from "../experts/types";

export type InspirationPack = {
  id: string;
  title: string;
  description: string;
  /** 展示分组（如"工作流"/"专家"），页面内以字典翻译。 */
  category: "workflow" | "expert";
  /** 应用到新会话的 prompt 正文。 */
  prompt: string;
  /** 绑定的本地技能（skill-catalog 的 id 或 name）。 */
  skills: string[];
  tags: string[];
  /** 可选：一键创建专家时的默认配置（name/description/methodology/model）。 */
  expertTemplate?: {
    name: string;
    description: string;
    methodology: string;
    model?: string;
  };
};

export type ExpertFromPackResult =
  | { ok: true; expertId: string }
  | { ok: false; error: string };

export function isExpertFromPackSuccess(result: ExpertFromPackResult): result is Extract<ExpertFromPackResult, { ok: true }> {
  return result.ok;
}

/** 从组合包生成专家表单载荷（name/systemPrompt/methodology/skills 齐全）。 */
export function buildExpertInputFromPack(pack: InspirationPack): ExpertInput {
  return {
    name: pack.expertTemplate?.name ?? pack.title,
    description: pack.expertTemplate?.description ?? pack.description,
    systemPrompt: pack.prompt,
    methodology: pack.expertTemplate?.methodology ?? "",
    skills: [...pack.skills],
    model: pack.expertTemplate?.model,
  };
}
