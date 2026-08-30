/**
 * 拓扑排序调度器测试 - 依赖图 → 分层执行队列
 */
import { describe, expect, test } from "bun:test";
import type { SubTaskAssignment } from "./supervisor.js";
import { topoSortAssignments } from "./scheduler.js";

function sub(id: string, deps: string[] = []): SubTaskAssignment {
  return { subtaskId: id, agentId: "a", prompt: id, dependencies: deps };
}

describe("topoSortAssignments", () => {
  test("空输入返回空计划", () => {
    const plan = topoSortAssignments([]);
    expect(plan.layers).toEqual([]);
    expect(plan.order).toEqual([]);
    expect(plan.cycles).toEqual([]);
  });

  test("无依赖 → 单层，全部 layer 0，保持输入顺序", () => {
    const plan = topoSortAssignments([sub("b"), sub("a"), sub("c")]);
    expect(plan.layers.length).toBe(1);
    expect(plan.layers[0]!.map((s) => s.subtaskId)).toEqual(["b", "a", "c"]);
    expect(plan.order.map((s) => s.subtaskId)).toEqual(["b", "a", "c"]);
    expect(plan.layers[0]!.every((s) => s.layer === 0)).toBe(true);
    expect(plan.cycles).toEqual([]);
  });

  test("链式依赖 A→B→C 分 3 层", () => {
    const plan = topoSortAssignments([
      sub("c", ["b"]),
      sub("a"),
      sub("b", ["a"]),
    ]);
    expect(plan.layers.map((l) => l.map((s) => s.subtaskId))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
    expect(plan.order.map((s) => s.subtaskId)).toEqual(["a", "b", "c"]);
    expect(plan.order.map((s) => s.layer)).toEqual([0, 1, 2]);
  });

  test("菱形依赖：A → {B,C} → D", () => {
    const plan = topoSortAssignments([
      sub("d", ["b", "c"]),
      sub("b", ["a"]),
      sub("c", ["a"]),
      sub("a"),
    ]);
    expect(plan.layers.map((l) => l.map((s) => s.subtaskId).sort())).toEqual([
      ["a"],
      ["b", "c"],
      ["d"],
    ]);
  });

  test("同层内并发：两个无依赖 + 一个依赖两者", () => {
    const plan = topoSortAssignments([
      sub("final", ["x", "y"]),
      sub("y"),
      sub("x"),
    ]);
    expect(plan.layers.map((l) => l.map((s) => s.subtaskId).sort())).toEqual([
      ["x", "y"],
      ["final"],
    ]);
  });

  test("环检测：A→B→A 返回环", () => {
    const plan = topoSortAssignments([sub("a", ["b"]), sub("b", ["a"])]);
    expect(plan.cycles.length).toBe(1);
    expect(plan.cycles[0]!.sort()).toEqual(["a", "b"]);
    // 环上节点不进入可执行队列
    expect(plan.order.some((s) => s.subtaskId === "a" || s.subtaskId === "b")).toBe(false);
    expect(plan.layers.flat().length).toBe(0);
  });

  test("混合：环 + 正常节点（正常节点仍可执行）", () => {
    const plan = topoSortAssignments([
      sub("ok"),
      sub("a", ["b"]),
      sub("b", ["a"]),
    ]);
    expect(plan.order.map((s) => s.subtaskId)).toEqual(["ok"]);
    expect(plan.cycles.length).toBe(1);
  });

  test("dangling 依赖（引用不存在节点）宽容处理：当作已满足", () => {
    const plan = topoSortAssignments([sub("a", ["ghost"]), sub("b", ["a"])]);
    expect(plan.dangling).toEqual(["a"]);
    // a 仍可执行（ghost 视为已满足），b 在下一层
    expect(plan.order.map((s) => s.subtaskId)).toEqual(["a", "b"]);
    expect(plan.cycles).toEqual([]);
  });

  test("全环（自环）检测", () => {
    const plan = topoSortAssignments([sub("self", ["self"])]);
    expect(plan.cycles.length).toBe(1);
    expect(plan.cycles[0]).toEqual(["self"]);
    expect(plan.order).toEqual([]);
  });

  test("多依赖重复引用不重复计数", () => {
    const plan = topoSortAssignments([
      sub("a"),
      sub("b", ["a", "a"]),
    ]);
    expect(plan.layers.map((l) => l.map((s) => s.subtaskId))).toEqual([
      ["a"],
      ["b"],
    ]);
  });

  test("深度链 5 层", () => {
    const plan = topoSortAssignments([
      sub("s5", ["s4"]),
      sub("s1"),
      sub("s4", ["s3"]),
      sub("s3", ["s2"]),
      sub("s2", ["s1"]),
    ]);
    expect(plan.order.map((s) => s.subtaskId)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(plan.order.map((s) => s.layer)).toEqual([0, 1, 2, 3, 4]);
  });
});
