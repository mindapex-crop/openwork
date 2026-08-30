/**
 * Task launch mode for the new-task composer. Pure helper module — no React,
 * no composer imports — so unit tests can exercise the framing/variant logic
 * without pulling in the editor graph.
 */

import type { ComponentType } from "react";

import { Lightbulb, MessageSquare, Sparkles } from "lucide-react";

import { t } from "@/i18n";

export type TaskMode = "ask" | "craft" | "plan";

/**
 * Plan-mode lifecycle phases. Kept here (rather than re-importing from the
 * plan domain) so the task-mode helper stays dependency-free and testable in
 * isolation. The canonical definition lives in `plan/plan-types.ts`.
 */
export type PlanModePhase = "clarify" | "draft" | "edit" | "execute" | "complete";

export const PLAN_MODE_PHASES: readonly PlanModePhase[] = [
  "clarify",
  "draft",
  "edit",
  "execute",
  "complete",
] as const;

export type TaskModeOption = {
  value: TaskMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

/** Ask / Plan / Craft 三模式的统一展示配置（空态 hero 与会话 composer 共用）。 */
export const TASK_MODE_OPTIONS: readonly TaskModeOption[] = [
  {
    value: "ask",
    label: t("task_mode.ask"),
    description: t("task_mode.ask_desc"),
    icon: MessageSquare,
  },
  {
    value: "craft",
    label: t("task_mode.craft"),
    description: t("task_mode.craft_desc"),
    icon: Sparkles,
  },
  {
    value: "plan",
    label: t("task_mode.plan"),
    description: t("task_mode.plan_desc"),
    icon: Lightbulb,
  },
];

/**
 * Translate a task-mode pick on the empty hero into a model-variant
 * recommendation. `null` means "use the user's saved default". The caller is
 * responsible for not overriding an explicitly saved variant.
 */
export function resolveTaskModeVariant(mode: TaskMode, currentFallback: string | null): string | null {
  switch (mode) {
    case "ask":
      // Fast path: direct, short answers. Keep whatever existing fallback the
      // picker already derived; we only bias craft/plan explicitly.
      return currentFallback;
    case "craft":
      // Prefer a "balanced" reasoning variant if the provider list exposes one.
      return "balanced";
    case "plan":
      // Deep reasoning for structured, multi-step plans.
      return "reasoning";
  }
}

/**
 * Plan mode is the only task mode that carries a persistent, multi-phase
 * lifecycle (clarify → draft → edit → execute → complete). Callers can use
 * this to decide whether to surface plan-specific UI (the Plans sidebar entry,
 * the plan dashboard) or fall back to simple prompt framing.
 */
export function isPlanModePersistent(mode: TaskMode): boolean {
  return mode === "plan";
}

/**
 * Determine the next plan phase in the lifecycle. Returns the same phase if
 * already at the end. Pure helper — no side effects, tests can exercise freely.
 */
export function nextPlanPhase(current: PlanModePhase): PlanModePhase {
  const index = PLAN_MODE_PHASES.indexOf(current);
  if (index === -1 || index >= PLAN_MODE_PHASES.length - 1) return current;
  return PLAN_MODE_PHASES[index + 1];
}

export function frameTaskPrompt(mode: TaskMode, rawPrompt: string): string {
  const trimmed = rawPrompt.trim();
  if (!trimmed) return trimmed;
  switch (mode) {
    case "ask":
      // 只读模式（WorkBuddy "问一问" 对标）：只回答与解释，不修改文件、不执行有副作用的操作。
      return `${trimmed}\n\nYou are in Ask (read-only) mode. Answer the question and explain as needed. Do NOT modify files, run state-changing commands, or take any action that alters the workspace.`;
    case "craft":
      return `${trimmed}\n\nIf this task requires writing or changing code, start with a short plan and then make concrete changes. Prefer the smallest change that accomplishes the goal.`;
    case "plan":
      return `${trimmed}\n\nDo not start executing yet. First produce a structured step-by-step plan that describes what you will do, what order you will do it in, and any information you need from me. After the plan, wait for me to confirm before you take any action.`;
  }
}
