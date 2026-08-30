/**
 * Synthesizer - 综合者角色
 *
 * 在 fan-out 完成之后，对各 subtask 的 finalText 做一次 LLM 汇总，
 * 产出统一的综合报告（对应 WorkBuddy 的 Synthesizer 专家角色）。
 *
 * LLM 调用复用 team-llm-executor.ts 的 OpenCode client 调用模式：
 * 调用方注入与 FunctionalSupervisor 相同签名的 llmExecutor。
 */

/** 综合输入 */
export interface SynthesizeInput {
  synthesisId: string;
  /** 原始任务描述 */
  taskPrompt: string;
  /** fan-out 各子任务的最终产出 */
  results: Array<{ subtaskId: string; agentId: string; finalText: string | null; error?: string }>;
  providerID: string;
  modelID: string;
  timeoutMs?: number;
}

/** 综合产出 */
export interface SynthesisOutcome {
  report: string;
  providerID: string;
  modelID: string;
  subtaskCount: number;
}

/** 与 team-llm-executor.ts 一致的 LLM 调用签名 */
export type SynthesisLlmExecutor = (params: {
  providerID: string;
  modelID: string;
  prompt: string;
  systemPrompt: string;
  timeoutMs: number;
}) => Promise<string>;

const DEFAULT_SYSTEM_PROMPT =
  "You are a synthesis expert. Read all subtask outputs below and produce one coherent, complete final report. " +
  "Combine findings, resolve contradictions, and highlight anything missing. Always respond in the language of the task.";

/** 构建综合 prompt（把各子任务产出拼装给 LLM） */
export function buildSynthesisPrompt(input: SynthesizeInput): string {
  const sections = input.results.map((r) => {
    const status = r.error ? `FAILED (${r.error})` : r.finalText !== null ? "OK" : "EMPTY";
    return `### ${r.subtaskId} [${r.agentId}] (${status})\n${r.finalText ?? (r.error ?? "(no output)")}`;
  });

  return [
    `Original task:\n${input.taskPrompt}`,
    ``,
    `Subtask outputs (${input.results.length}):`,
    sections.join("\n\n"),
    ``,
    `Write the final synthesized report.`,
  ].join("\n");
}

/**
 * 执行综合：调用 LLM 汇总各子任务产出。
 */
export async function synthesizeResults(
  input: SynthesizeInput,
  llmExecutor: SynthesisLlmExecutor,
): Promise<SynthesisOutcome> {
  const prompt = buildSynthesisPrompt(input);
  const report = await llmExecutor({
    providerID: input.providerID,
    modelID: input.modelID,
    prompt,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    timeoutMs: input.timeoutMs ?? 60_000,
  });

  return {
    report,
    providerID: input.providerID,
    modelID: input.modelID,
    subtaskCount: input.results.length,
  };
}
