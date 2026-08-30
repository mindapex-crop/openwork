/**
 * 会话级目标（/goal，对标 Qoder 的目标语义）的纯逻辑：目标记录、参数解析、
 * 轮次预算和系统上下文框定。
 *
 * 纯模块 —— 不 import React、不 import 任何 store，仿 `composer-capabilities.ts`。
 * 与 Codex 式一次性目标的关键区别：目标有**状态**（进行中 / 已完成 / 受阻）和
 * **轮次预算**，且跨轮持续注入 `system`，直到完成、受阻或被清除。
 */

export type GoalStatus = "active" | "complete" | "blocked";

export type SessionGoal = {
  objective: string;
  status: GoalStatus;
  /** 目标激活后已消耗的用户轮次。 */
  turns: number;
  /** 轮次预算上限；null 表示不限。 */
  maxTurns: number | null;
};

/** 幂等标记：目标块已注入时用它短路，避免重复污染系统上下文。 */
export const GOAL_MARKER = "[openwork-session-goal]";

export const GOAL_TURN_BUDGET_MIN = 1;
export const GOAL_TURN_BUDGET_MAX = 100;

export type GoalCommand =
  | { kind: "status" }
  | { kind: "clear" }
  | { kind: "complete" }
  | { kind: "block" }
  | { kind: "resume" }
  | { kind: "set"; goal: SessionGoal };

const CLEAR_RE = /^(?:clear|off|reset|取消|清除)$/i;
const COMPLETE_RE = /^(?:complete|done|finish|完成|达成)$/i;
const BLOCK_RE = /^(?:block|blocked|pause|hold|受阻|暂停)$/i;
const RESUME_RE = /^(?:resume|continue|恢复|继续)$/i;
const STATUS_RE = /^(?:status|progress|状态|进度)$/i;
const BUDGET_FLAGS = /(?:^|\s)(?:--turns|--budget|-t)[= ]+(\d+)/i;
const BUDGET_SUFFIX = /\s+(?:in|for|within)\s+(\d+)\s+turns?$/i;
const BUDGET_SUFFIX_ZH = /\s*(\d+)\s*轮(?:以内|之内|内)?\s*$/;

/** 解析预算标记，返回清洗后的目标文本和上限；标记非法或越界时忽略预算。 */
function extractTurnBudget(objective: string): { objective: string; maxTurns: number | null } {
  const match = BUDGET_FLAGS.exec(objective) ?? BUDGET_SUFFIX.exec(objective) ?? BUDGET_SUFFIX_ZH.exec(objective);
  if (!match?.[1]) return { objective, maxTurns: null };
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return { objective, maxTurns: null };
  const maxTurns = Math.min(Math.max(Math.trunc(parsed), GOAL_TURN_BUDGET_MIN), GOAL_TURN_BUDGET_MAX);
  const stripped = objective.replace(match[0], " ").replace(/\s{2,}/g, " ").trim();
  return { objective: stripped, maxTurns };
}

export function makeGoal(objective: string, maxTurns: number | null = null): SessionGoal {
  return { objective: objective.trim(), status: "active", turns: 0, maxTurns };
}

/**
 * 把 `/goal` 的参数解析成一条命令。
 *
 * - 空白 → `status`（调用方在无目标时降级为用法提示）；
 * - 状态词（clear/complete/block/resume 及中文同义词）→ 对应状态迁移；
 * - 其余 → `set`，并剥离 `--turns N` / `N 轮` 之类的预算标记。
 */
export function parseGoalCommand(args: string | null | undefined): GoalCommand {
  const trimmed = args?.trim() ?? "";
  if (!trimmed) return { kind: "status" };
  if (CLEAR_RE.test(trimmed)) return { kind: "clear" };
  if (COMPLETE_RE.test(trimmed)) return { kind: "complete" };
  if (BLOCK_RE.test(trimmed)) return { kind: "block" };
  if (RESUME_RE.test(trimmed)) return { kind: "resume" };
  if (STATUS_RE.test(trimmed)) return { kind: "status" };

  const { objective, maxTurns } = extractTurnBudget(trimmed);
  if (!objective) return { kind: "status" };
  return { kind: "set", goal: makeGoal(objective, maxTurns) };
}

/** 展示用轮次：受阻会把计数推进到预算外一轮，展示时夹到预算上限。 */
function usedTurns(goal: SessionGoal): number {
  return goal.maxTurns === null ? goal.turns : Math.min(goal.turns, goal.maxTurns);
}

/** 目标剩余可用轮次；不限预算时返回 null。 */
export function remainingGoalTurns(goal: SessionGoal): number | null {
  if (goal.maxTurns === null) return null;
  return Math.max(goal.maxTurns - goal.turns, 0);
}

/** 紧凑进度标签：有预算时 `3/10`，否则 `3`。供芯片与状态提示共用。 */
export function formatGoalProgress(goal: SessionGoal): string {
  return goal.maxTurns === null ? `${goal.turns}` : `${usedTurns(goal)}/${goal.maxTurns}`;
}

/**
 * 记录一次用户轮次。仅对进行中的目标计数；**超出**预算时才置为受阻——
 * 正好用满预算的那一轮仍是有效工作轮，用户再发一轮才受阻。
 * 非进行中或无目标时原样返回（幂等，重复调用不会再推进状态）。
 */
export function advanceGoalTurn(goal: SessionGoal | null | undefined): SessionGoal | null {
  if (!goal || goal.status !== "active") return goal ?? null;
  const turns = goal.turns + 1;
  const exhausted = goal.maxTurns !== null && turns > goal.maxTurns;
  return { ...goal, turns, status: exhausted ? "blocked" : "active" };
}

function progressLabel(goal: SessionGoal): string {
  const used = usedTurns(goal);
  return goal.maxTurns === null ? `${goal.turns} turns used` : `turn ${used} of ${goal.maxTurns}`;
}

/**
 * 把目标渲染为一段系统上下文。
 *
 * - 无目标 / 目标为空 / 已完成 → `null`（调用方跳过注入）；
 * - 受阻 → 明确要求停手并向用户求助，而不是继续推进；
 * - 进行中 → 目标文本 + 轮次进度 + 持久化说明。
 */
export function buildGoalSystemBlock(goal: SessionGoal | null | undefined): string | null {
  const objective = goal?.objective.trim();
  if (!goal || !objective) return null;
  if (objective.includes(GOAL_MARKER)) return null;
  if (goal.status === "complete") return null;

  if (goal.status === "blocked") {
    return [
      GOAL_MARKER,
      `Goal "${objective}" is blocked after ${progressLabel(goal)}.`,
      "Do not keep pushing on your own. Summarize the blocker and what you need from the user to resume.",
    ].join("\n");
  }

  return [
    GOAL_MARKER,
    `Active goal for this session: "${objective}"`,
    `Progress: ${progressLabel(goal)}.`,
    "Keep every step aligned with this outcome. The goal persists across turns until it is completed, blocked, or cleared with /goal clear.",
  ].join("\n");
}
