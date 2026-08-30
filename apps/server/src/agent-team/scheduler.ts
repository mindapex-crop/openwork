/**
 * Scheduler - 依赖图拓扑排序调度器
 *
 * 输入 Supervisor 产出的 SubTaskAssignment[]（含 dependencies），
 * 输出按依赖顺序的分层执行队列：
 * - 无依赖的先执行
 * - 依赖满足后再执行下游
 * - 同一层内无依赖关系，可并发执行
 *
 * 宽容策略：
 * - dangling 依赖（引用了不存在的 subtaskId）视为已满足，不阻塞执行
 * - 环检测：环上节点从可执行队列剔除，并在 cycles 中报告
 */

import type { SubTaskAssignment } from "./supervisor.js";

/** 带层号的任务（layer = 拓扑深度，0 起） */
export interface ScheduledAssignment extends SubTaskAssignment {
  layer: number;
}

export interface TopoPlan {
  /** 分层执行队列：layers[i] 内所有任务可并发，层间串行 */
  layers: ScheduledAssignment[][];
  /** 全序执行队列（稳定：同层内按输入顺序） */
  order: ScheduledAssignment[];
  /** 检测到的环（每项为环上 subtaskId 列表） */
  cycles: string[][];
  /** 引用了不存在依赖的 subtaskId 列表 */
  dangling: string[];
}

/**
 * 对子任务分配做拓扑排序。
 *
 * 实现：Kahn 算法（BFS 分层）。
 * - 入度 = 依赖中可解析（存在且非环）的依赖数量
 * - 每轮取出所有入度为 0 的节点作为一层
 * - 剩余节点构成环
 */
export function topoSortAssignments(assignments: SubTaskAssignment[]): TopoPlan {
  const byId = new Map<string, SubTaskAssignment>();
  for (const a of assignments) byId.set(a.subtaskId, a);

  // 记录 dangling：依赖项不存在于 assignments 集合
  const dangling = new Set<string>();
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // depId → 依赖它的 subtaskId 列表

  for (const a of assignments) {
    const deps: string[] = [];
    const seen = new Set<string>();
    for (const d of a.dependencies ?? []) {
      if (!byId.has(d)) {
        dangling.add(a.subtaskId);
        continue;
      }
      if (seen.has(d)) continue; // 重复依赖不重复计数
      seen.add(d);
      deps.push(d);
    }
    indegree.set(a.subtaskId, deps.length);
    for (const d of deps) {
      const list = dependents.get(d) ?? [];
      list.push(a.subtaskId);
      dependents.set(d, list);
    }
  }

  // Kahn：初始入度 0 的节点
  const ready: string[] = assignments
    .filter((a) => (indegree.get(a.subtaskId) ?? 0) === 0)
    .map((a) => a.subtaskId);

  const layers: ScheduledAssignment[][] = [];
  const order: ScheduledAssignment[] = [];
  const layerOf = new Map<string, number>();

  while (ready.length > 0) {
    const current = [...ready];
    ready.length = 0;
    const layer: ScheduledAssignment[] = [];

    for (const id of current) {
      const assignment = byId.get(id);
      if (!assignment) continue;
      const layerIndex = layers.length;
      const scheduled: ScheduledAssignment = { ...assignment, layer: layerIndex };
      layerOf.set(id, layerIndex);
      layer.push(scheduled);
      order.push(scheduled);

      for (const dependentId of dependents.get(id) ?? []) {
        const next = (indegree.get(dependentId) ?? 1) - 1;
        indegree.set(dependentId, next);
        if (next === 0) ready.push(dependentId);
      }
    }

    layers.push(layer);
  }

  // 剩余未调度节点 = 环
  const scheduledIds = new Set(order.map((s) => s.subtaskId));
  const cycles: string[][] = [];
  const visited = new Set<string>();
  for (const a of assignments) {
    if (scheduledIds.has(a.subtaskId) || visited.has(a.subtaskId)) continue;
    // 收集该环上的所有节点（简单分组：把互相可达的剩余节点聚为一组）
    const cycleGroup: string[] = [];
    for (const b of assignments) {
      if (scheduledIds.has(b.subtaskId) || visited.has(b.subtaskId)) continue;
      if (isReachableInRemaining(byId, scheduledIds, a.subtaskId, b.subtaskId)) {
        cycleGroup.push(b.subtaskId);
        visited.add(b.subtaskId);
      }
    }
    if (cycleGroup.length > 0) {
      visited.add(a.subtaskId);
      cycles.push(cycleGroup);
    }
  }

  return {
    layers,
    order,
    cycles,
    dangling: Array.from(dangling),
  };
}

/** 在剩余（未调度）节点子图中，from 是否能到达 to（用于环分组） */
function isReachableInRemaining(
  byId: Map<string, SubTaskAssignment>,
  scheduled: Set<string>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const dep of byId.get(cur)?.dependencies ?? []) {
      if (scheduled.has(dep)) continue; // 跳过已调度节点
      if (dep === to) return true;
      stack.push(dep);
    }
  }
  return false;
}
