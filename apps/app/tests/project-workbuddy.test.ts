import "./_setup/localstorage";
import { describe, expect, test } from "bun:test";

import type { Plan, Project, Task } from "../src/react-app/domains/projects/project-store";
import {
  groupTasksByStatus,
  planTaskProgress,
} from "../src/react-app/domains/projects/project-tasks-group";
import {
  filterProjectsByScope,
  projectCardDateLabel,
} from "../src/react-app/domains/projects/project-display";

function task(id: string, status: Task["status"], title = id): Task {
  return {
    id,
    title,
    status,
    evidence: { status: "pending", notes: "" },
    subtasks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function plan(tasks: Task[]): Plan {
  return {
    id: "p1",
    title: "Plan",
    description: "",
    status: "open",
    tasks,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function project(over: Partial<Project>): Project {
  return {
    id: over.id ?? "prj",
    name: over.name ?? "P",
    description: "",
    status: "active",
    plans: [],
    skills: [],
    experts: [],
    connectors: [],
    activityEvents: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...over,
  };
}

describe("groupTasksByStatus (WorkBuddy 任务栏分组)", () => {
  test("null plan yields no groups", () => {
    expect(groupTasksByStatus(null)).toEqual([]);
  });

  test("buckets tasks by status in PROJECT_WORK_COLUMNS order, dropping empty", () => {
    const groups = groupTasksByStatus(plan([
      task("t1", "done"),
      task("t2", "todo"),
      task("t3", "todo"),
      task("t4", "review"),
    ]));
    expect(groups.map((g) => g.status)).toEqual(["todo", "review", "done"]);
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[1].tasks).toHaveLength(1);
    expect(groups.find((g) => g.status === "in_progress")).toBeUndefined();
  });

  test("planTaskProgress counts done vs total", () => {
    const p = plan([task("a", "done"), task("b", "todo"), task("c", "done")]);
    expect(planTaskProgress(p)).toEqual({ done: 2, total: 3 });
    expect(planTaskProgress(null)).toEqual({ done: 0, total: 0 });
  });
});

describe("project list display helpers (WorkBuddy 列表)", () => {
  test("projectCardDateLabel renders a date from updatedAt", () => {
    expect(projectCardDateLabel(project({}))).not.toBe("");
  });

  test("projectCardDateLabel is empty for an invalid date", () => {
    expect(projectCardDateLabel(project({ updatedAt: "not-a-date", createdAt: "" }))).toBe("");
  });

  test("filterProjectsByScope: all returns everything", () => {
    const items = [project({ id: "a", threadId: "ses_1" }), project({ id: "b" })];
    expect(filterProjectsByScope(items, "all")).toHaveLength(2);
  });

  test("filterProjectsByScope: joined returns only thread-bound projects", () => {
    const items = [project({ id: "a", threadId: "ses_1" }), project({ id: "b" })];
    const joined = filterProjectsByScope(items, "joined");
    expect(joined.map((p) => p.id)).toEqual(["a"]);
  });
});
