/**
 * 会话级目标（/goal）状态：按 `sessionId` 存储每个会话的目标记录。
 *
 * 仿 `composer-capability-store.ts`，但关键区别：能力选择是**一次性**的
 * （首条任务发出后由发送路径清除），而目标是**会话级、跨轮持续**的——带状态与
 * 轮次预算，发送后不清除，仅在完成、受阻或用户 `/goal clear` 时变化。
 */

import { create } from "zustand";

import {
  advanceGoalTurn,
  type GoalCommand,
  type SessionGoal,
} from "./composer-goal";

type ComposerGoalStore = {
  /** sessionId → 目标记录。 */
  goals: Record<string, SessionGoal>;
  write: (sessionId: string, goal: SessionGoal | null) => void;
};

export const useSessionGoalStore = create<ComposerGoalStore>((set) => ({
  goals: {},

  write: (sessionId, goal) =>
    set((state) => {
      if (goal === null) {
        if (!(sessionId in state.goals)) return state;
        const goals = { ...state.goals };
        delete goals[sessionId];
        return { goals };
      }
      return { goals: { ...state.goals, [sessionId]: goal } };
    }),
}));

/** 读取指定会话的目标（无则返回 null）。供发送路径等非组件上下文使用。 */
export function getSessionGoal(sessionId: string): SessionGoal | null {
  return useSessionGoalStore.getState().goals[sessionId] ?? null;
}

export function setSessionGoal(sessionId: string, goal: SessionGoal): void {
  useSessionGoalStore.getState().write(sessionId, goal);
}

export function clearSessionGoal(sessionId: string): void {
  useSessionGoalStore.getState().write(sessionId, null);
}

function transition(sessionId: string, next: (goal: SessionGoal) => SessionGoal): void {
  const current = getSessionGoal(sessionId);
  if (!current) return;
  setSessionGoal(sessionId, next(current));
}

export function completeSessionGoal(sessionId: string): void {
  transition(sessionId, (goal) => ({ ...goal, status: "complete" }));
}

export function blockSessionGoal(sessionId: string): void {
  transition(sessionId, (goal) => ({ ...goal, status: "blocked" }));
}

export function resumeSessionGoal(sessionId: string): void {
  transition(sessionId, (goal) => ({ ...goal, status: "active" }));
}

/** 计入一次用户轮次并返回结果目标；预算耗尽时目标自动转为受阻。无目标时返回 null。 */
export function advanceSessionGoalTurn(sessionId: string): SessionGoal | null {
  const current = getSessionGoal(sessionId);
  const advanced = advanceGoalTurn(current);
  if (!advanced || advanced === current) return advanced;
  setSessionGoal(sessionId, advanced);
  return advanced;
}

/** 应用一条已解析的 /goal 命令。调用方负责提示文案。 */
export function applyGoalCommand(sessionId: string, command: GoalCommand): void {
  switch (command.kind) {
    case "clear":
      clearSessionGoal(sessionId);
      return;
    case "complete":
      completeSessionGoal(sessionId);
      return;
    case "block":
      blockSessionGoal(sessionId);
      return;
    case "resume":
      resumeSessionGoal(sessionId);
      return;
    case "set":
      setSessionGoal(sessionId, command.goal);
      return;
    case "status":
      return;
  }
}
