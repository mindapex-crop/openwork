import type { Plan, Task, TaskStatus } from "./project-store";
import { PROJECT_WORK_COLUMNS } from "./project-store";

export type TaskStatusGroup = {
  status: TaskStatus;
  tasks: Task[];
};

/**
 * WorkBuddy 任务栏按状态分组（待执行/评审中/待确认/已完成 …）的纯逻辑，
 * 顺序沿用 PROJECT_WORK_COLUMNS，便于单测且不依赖渲染。
 */
export function groupTasksByStatus(plan: Plan | null): TaskStatusGroup[] {
  if (!plan) return [];
  return PROJECT_WORK_COLUMNS.map((status) => ({
    status,
    tasks: plan.tasks.filter((task) => task.status === status),
  })).filter((group) => group.tasks.length > 0);
}

/** 已完成 / 总数（用于任务栏进度，如 "待执行 1/5" 的计数）。 */
export function planTaskProgress(plan: Plan | null): { done: number; total: number } {
  if (!plan) return { done: 0, total: 0 };
  const total = plan.tasks.length;
  const done = plan.tasks.filter((task) => task.status === "done").length;
  return { done, total };
}
