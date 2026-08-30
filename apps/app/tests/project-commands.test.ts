import { afterEach, describe, expect, test } from "bun:test";

import { parseProjectCommand } from "../src/react-app/domains/projects/project-commands";

describe("parseProjectCommand", () => {
  test("empty input returns empty kind", () => {
    expect(parseProjectCommand("", null, null)).toEqual({ kind: "empty" });
    expect(parseProjectCommand("   ", null, null)).toEqual({ kind: "empty" });
  });

  test("新建任务 creates a task (zh)", () => {
    const result = parseProjectCommand("新建任务 实现登录页面", null, null);
    expect(result).toEqual({ kind: "create_task", title: "实现登录页面" });
  });

  test("task / add task creates a task (en)", () => {
    expect(parseProjectCommand("task Fix the bug", null, null)).toEqual({
      kind: "create_task",
      title: "Fix the bug",
    });
    expect(parseProjectCommand("add task Write tests", null, null)).toEqual({
      kind: "create_task",
      title: "Write tests",
    });
  });

  test("完成任务 completes a task (zh)", () => {
    const result = parseProjectCommand("完成任务 登录页面", null, null);
    expect(result).toEqual({ kind: "complete_task", keyword: "登录页面" });
  });

  test("complete / done completes a task (en)", () => {
    expect(parseProjectCommand("complete Login page", null, null)).toEqual({
      kind: "complete_task",
      keyword: "Login page",
    });
    expect(parseProjectCommand("done Login page", null, null)).toEqual({
      kind: "complete_task",
      keyword: "Login page",
    });
  });

  test("分配 assigns a task (zh)", () => {
    const result = parseProjectCommand("分配 登录页面 给 张三", null, null);
    expect(result).toEqual({ kind: "assign_task", keyword: "登录页面", assignee: "张三" });
  });

  test("assign assigns a task (en)", () => {
    const result = parseProjectCommand("assign Login page to Alice", null, null);
    expect(result).toEqual({ kind: "assign_task", keyword: "Login page", assignee: "Alice" });
  });

  test("切换计划 switches plan (zh)", () => {
    const result = parseProjectCommand("切换计划 MVP", null, null);
    expect(result).toEqual({ kind: "switch_plan", name: "MVP" });
  });

  test("switch plan switches plan (en)", () => {
    const result = parseProjectCommand("switch plan Sprint 2", null, null);
    expect(result).toEqual({ kind: "switch_plan", name: "Sprint 2" });
  });

  test("unrecognized text falls back to note", () => {
    const result = parseProjectCommand("remember to update docs", null, null);
    expect(result).toEqual({ kind: "note", text: "remember to update docs" });
  });

  test("commands are case-insensitive", () => {
    expect(parseProjectCommand("TASK Build API", null, null).kind).toBe("create_task");
    expect(parseProjectCommand("COMPLETE the login", null, null).kind).toBe("complete_task");
    expect(parseProjectCommand("DONE the login", null, null).kind).toBe("complete_task");
    expect(parseProjectCommand("ASSIGN login to Bob", null, null).kind).toBe("assign_task");
    expect(parseProjectCommand("SWITCH PLAN v2", null, null).kind).toBe("switch_plan");
  });

  test("leading/trailing whitespace is trimmed", () => {
    const result = parseProjectCommand("  新建任务 清理缓存  ", null, null);
    expect(result).toEqual({ kind: "create_task", title: "清理缓存" });
  });
});
