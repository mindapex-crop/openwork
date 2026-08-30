/**
 * Plan domain store — a fully local-first model (no backend).
 *
 * Zustand store with localStorage persistence via `zustand/middleware/persist`.
 * Mirrors the project-store pattern: in-memory state + automatic rehydration,
 * with a version field ready for future migrations.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Plan, PlanInput, PlanPhase, PlanTask, PlanTaskStatus } from "./plan-types";

export const PERSISTED_PLANS_KEY = "openwork:plans:v1";
export const PLAN_STORE_VERSION = 1;

function now(): string {
  return new Date().toISOString();
}

export type PlanStore = {
  plans: Plan[];
  createPlan: (input: PlanInput) => string;
  updatePlan: (id: string, patch: Partial<PlanInput>) => void;
  deletePlan: (id: string) => void;
  listPlans: () => Plan[];
  getPlan: (id: string) => Plan | undefined;
  advancePhase: (id: string) => void;
  setPhase: (id: string, phase: PlanPhase) => void;
  updateTaskStatus: (planId: string, taskId: string, status: PlanTaskStatus) => void;
  addTask: (planId: string, task: PlanTask) => void;
  removeTask: (planId: string, taskId: string) => void;
  reorderTasks: (planId: string, fromIndex: number, toIndex: number) => void;
};

function applyPlanMutation(
  state: PlanStore,
  id: string,
  mutate: (plan: Plan) => Plan,
): PlanStore {
  const plans = state.plans.map((plan) => {
    if (plan.id !== id) return plan;
    return { ...mutate({ ...plan }), updatedAt: now() };
  });
  return plans === state.plans ? state : { ...state, plans };
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      plans: [],

      createPlan: (input) => {
        const id = crypto.randomUUID();
        const timestamp = now();
        const plan: Plan = {
          id,
          title: input.title,
          description: input.description,
          requirements: input.requirements,
          technicalApproach: input.technicalApproach,
          tasks: input.tasks,
          phase: "clarify",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({ plans: [...state.plans, plan] }));
        return id;
      },

      updatePlan: (id, patch) =>
        set((state) => applyPlanMutation(state, id, (plan) => ({ ...plan, ...patch }))),

      deletePlan: (id) =>
        set((state) => ({ plans: state.plans.filter((plan) => plan.id !== id) })),

      listPlans: () => {
        return get().plans;
      },

      getPlan: (id) => {
        return get().plans.find((plan) => plan.id === id);
      },

      advancePhase: (id) =>
        set((state) => {
          const PHASE_ORDER: PlanPhase[] = ["clarify", "draft", "edit", "execute", "complete"];
          return applyPlanMutation(state, id, (plan) => {
            const currentIndex = PHASE_ORDER.indexOf(plan.phase);
            if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
              return plan;
            }
            return { ...plan, phase: PHASE_ORDER[currentIndex + 1] };
          });
        }),

      setPhase: (id, phase) =>
        set((state) => applyPlanMutation(state, id, (plan) => ({ ...plan, phase }))),

      updateTaskStatus: (planId, taskId, status) =>
        set((state) =>
          applyPlanMutation(state, planId, (plan) => ({
            ...plan,
            tasks: plan.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
          })),
        ),

      addTask: (planId, task) =>
        set((state) =>
          applyPlanMutation(state, planId, (plan) => ({
            ...plan,
            tasks: [...plan.tasks, task],
          })),
        ),

      removeTask: (planId, taskId) =>
        set((state) =>
          applyPlanMutation(state, planId, (plan) => ({
            ...plan,
            tasks: plan.tasks.filter((task) => task.id !== taskId),
          })),
        ),

      reorderTasks: (planId, fromIndex, toIndex) =>
        set((state) =>
          applyPlanMutation(state, planId, (plan) => {
            if (
              fromIndex < 0
              || fromIndex >= plan.tasks.length
              || toIndex < 0
              || toIndex >= plan.tasks.length
            ) {
              return plan;
            }
            const tasks = [...plan.tasks];
            const [moved] = tasks.splice(fromIndex, 1);
            if (!moved) return plan;
            tasks.splice(toIndex, 0, moved);
            return { ...plan, tasks };
          }),
        ),
    }),
    {
      name: PERSISTED_PLANS_KEY,
      version: PLAN_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ---------- Selector hooks ----------

export function usePlans(): Plan[] {
  return usePlanStore((state) => state.plans);
}

export function usePlan(planId: string | null): Plan | undefined {
  return usePlanStore((state) =>
    planId ? state.plans.find((plan) => plan.id === planId) : undefined,
  );
}
