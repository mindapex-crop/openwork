/**
 * Composer 能力引用（智能体 / 连接器）的提示词框定。
 *
 * 纯模块 —— 不 import React、不 import 任何 store，仿 `chat/task-mode.ts`：
 * 单元测试可直接exercise框定逻辑，无需拉起 composer 图。调用方负责把
 * store 里的 id 解析成这里的 descriptor。
 */

export type ComposerCapabilities = {
  /** 选中的专家 id；null 表示未引用智能体。 */
  expertId: string | null;
  /** 选中的 IM 连接器 id 列表（仅已连接的可选）。 */
  connectorIds: string[];
};

export const EMPTY_COMPOSER_CAPABILITIES: ComposerCapabilities = {
  expertId: null,
  connectorIds: [],
};

/** 已解析的专家描述：只有框定需要的三个字段，避免耦合 experts 领域类型。 */
export type CapabilityExpert = {
  name: string;
  systemPrompt?: string;
  skills?: readonly string[];
};

export type CapabilityContext = {
  expert: CapabilityExpert | null;
  connectorLabels: readonly string[];
};

/** 幂等标记：重复框定时用它短路，避免污染提示词。 */
const FRAME_MARKER = "[openwork-composer-capabilities]";

function hasCapabilities(context: CapabilityContext): boolean {
  return context.expert !== null || context.connectorLabels.length > 0;
}

/**
 * 把已选的智能体与连接器追加到待发提示词尾部。
 *
 * 未选择任何能力时**原样返回**（含 trim 语义与 frameTaskPrompt 一致）；
 * 已框定过（含标记）时同样原样返回，保证幂等。
 */
export function frameCapabilityPrompt(context: CapabilityContext, rawPrompt: string): string {
  const trimmed = rawPrompt.trim();
  if (!trimmed || !hasCapabilities(context)) return rawPrompt;
  if (trimmed.includes(FRAME_MARKER)) return rawPrompt;

  const blocks: string[] = [];

  if (context.expert) {
    const expertLines = [`You are acting as the expert "${context.expert.name}".`];
    const systemPrompt = context.expert.systemPrompt?.trim();
    if (systemPrompt) {
      expertLines.push(`Expert instructions: ${systemPrompt}`);
    }
    for (const skill of context.expert.skills ?? []) {
      const name = skill.trim();
      if (name) expertLines.push(`Load [skill ${name}] and follow its instructions.`);
    }
    blocks.push(expertLines.join("\n"));
  }

  if (context.connectorLabels.length > 0) {
    const targets = context.connectorLabels
      .map((label) => label.trim())
      .filter((label) => label.length > 0);
    if (targets.length > 0) {
      blocks.push(
        `Deliver the final result to these IM channels: ${targets.join(", ")}.`,
      );
    }
  }

  if (blocks.length === 0) return rawPrompt;
  return `${trimmed}\n\n${FRAME_MARKER}\n${blocks.join("\n\n")}`;
}
