/**
 * Task launch mode for the new-task composer. Pure helper module — no React,
 * no composer imports — so unit tests can exercise the framing/variant logic
 * without pulling in the editor graph.
 */

export type TaskMode = "ask" | "craft" | "plan";

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
 * Wrap a user's raw prompt with mode-specific framing instructions before
 * sending it to the first session. We intentionally keep instructions short:
 * the model behaviour variant carries the heavier reasoning weight. Plan mode
 * is the only one that visibly changes the output contract so the user sees
 * a plan first instead of jumping straight into execution.
 */
export function frameTaskPrompt(mode: TaskMode, rawPrompt: string): string {
  const trimmed = rawPrompt.trim();
  if (!trimmed) return trimmed;
  switch (mode) {
    case "ask":
      return trimmed;
    case "craft":
      return `${trimmed}\n\nIf this task requires writing or changing code, start with a short plan and then make concrete changes. Prefer the smallest change that accomplishes the goal.`;
    case "plan":
      return `${trimmed}\n\nDo not start executing yet. First produce a structured step-by-step plan that describes what you will do, what order you will do it in, and any information you need from me. After the plan, wait for me to confirm before you take any action.`;
  }
}
