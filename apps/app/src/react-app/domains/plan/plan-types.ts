/**
 * Plan mode lifecycle types.
 *
 * Five-phase planning experience:
 *   clarify  → draft → edit → execute → complete
 *
 * A Plan is the top-level unit. Each Plan owns an ordered list of PlanTasks
 * that can be tracked individually during the execute phase.
 */

export type PlanPhase = "clarify" | "draft" | "edit" | "execute" | "complete";

export const PLAN_PHASES: readonly PlanPhase[] = [
  "clarify",
  "draft",
  "edit",
  "execute",
  "complete",
] as const;

export const PLAN_PHASE_LABELS: Record<PlanPhase, string> = {
  clarify: "plan.phase.clarify",
  draft: "plan.phase.draft",
  edit: "plan.phase.edit",
  execute: "plan.phase.execute",
  complete: "plan.phase.complete",
};

export type PlanTaskStatus = "pending" | "in_progress" | "completed" | "failed";

export type PlanTask = {
  id: string;
  title: string;
  description: string;
  status: PlanTaskStatus;
  dependencies?: string[];
  estimatedEffort?: "low" | "medium" | "high";
};

export type Plan = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  technicalApproach: string;
  tasks: PlanTask[];
  phase: PlanPhase;
  createdAt: string;
  updatedAt: string;
};

export type PlanInput = {
  title: string;
  description: string;
  requirements: string;
  technicalApproach: string;
  tasks: PlanTask[];
};
