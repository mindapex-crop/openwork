import "./_setup/localstorage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  PERSISTED_PROJECTS_KEY,
  useProjectStore,
} from "../src/react-app/domains/projects/project-store";

function resetStore() {
  try {
    globalThis.localStorage.removeItem(PERSISTED_PROJECTS_KEY);
  } catch {}
  useProjectStore.setState({ projects: [] });
}

afterEach(() => {
  resetStore();
});

describe("project store — WorkBuddy Project → Plan → Task model", () => {
  test("createProject returns a new id, stores a project with default active status", () => {
    const id = useProjectStore.getState().createProject("  Build agent  ", "  Notes  ");
    expect(typeof id).toBe("string");
    expect(id.length > 0).toBe(true);

    const project = useProjectStore.getState().projects.find((x) => x.id === id);
    expect(project).toBeDefined();
    if (!project) return;
    // The store passes values through unchanged; trimming is a UI concern.
    expect(project.name).toBe("  Build agent  ");
    expect(project.description).toBe("  Notes  ");
    expect(project.status).toBe("active");
    expect(project.plans).toEqual([]);
  });

  test("createProject with empty name still creates (store does not validate; UI does)", () => {
    const id = useProjectStore.getState().createProject("");
    const project = useProjectStore.getState().projects.find((x) => x.id === id);
    expect(project?.name).toBe("");
  });

  test("addPlan appends a plan with open status and empty tasks", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Milestone 1", "desc");
    const project = useProjectStore.getState().projects.find((x) => x.id === projectId)!;
    expect(project.plans).toHaveLength(1);
    expect(project.plans[0].title).toBe("Milestone 1");
    expect(project.plans[0].description).toBe("desc");
    expect(project.plans[0].status).toBe("open");
    expect(project.plans[0].tasks).toEqual([]);
  });

  test("addTask initializes with empty subtasks and pending evidence", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Write docs");
    const task = useProjectStore.getState().projects[0].plans[0].tasks[0];
    expect(task.title).toBe("Write docs");
    expect(task.status).toBe("todo");
    expect(task.subtasks).toEqual([]);
    expect(task.evidence).toEqual({ status: "pending", notes: "" });
    expect(task.assignee).toBeUndefined();
  });

  test("updateTaskStatus moves a task through Todo → In progress → Review → Done", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().updateTaskStatus(projectId, planId, taskId, "in_progress");
    useProjectStore.getState().updateTaskStatus(projectId, planId, taskId, "review");
    useProjectStore.getState().updateTaskStatus(projectId, planId, taskId, "done");
    expect(useProjectStore.getState().projects[0].plans[0].tasks[0].status).toBe("done");
  });

  test("addSubtask/toggleSubtask/removeSubtask manage task decomposition", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().addSubtask(projectId, planId, taskId, "Research");
    const subtask = useProjectStore.getState().projects[0].plans[0].tasks[0].subtasks[0];
    expect(subtask.title).toBe("Research");
    expect(subtask.done).toBe(false);

    useProjectStore.getState().toggleSubtask(projectId, planId, taskId, subtask.id);
    expect(useProjectStore.getState().projects[0].plans[0].tasks[0].subtasks[0].done).toBe(true);

    useProjectStore.getState().removeSubtask(projectId, planId, taskId, subtask.id);
    expect(useProjectStore.getState().projects[0].plans[0].tasks[0].subtasks).toHaveLength(0);
  });

  test("setTaskAssignee records the WorkBuddy agent role", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().setTaskAssignee(projectId, planId, taskId, "architect");
    expect(useProjectStore.getState().projects[0].plans[0].tasks[0].assignee).toBe("architect");
  });

  test("setTaskEvidence records verdict and notes", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().setTaskEvidence(projectId, planId, taskId, {
      status: "passed",
      notes: "tape green",
      approvedBy: "dev-agent",
      approvedAt: new Date().toISOString(),
    });
    const evidence = useProjectStore.getState().projects[0].plans[0].tasks[0].evidence;
    expect(evidence.status).toBe("passed");
    expect(evidence.notes).toBe("tape green");
    expect(evidence.approvedBy).toBe("dev-agent");
    expect(evidence.approvedAt).toBeDefined();
  });

  test("setTaskEvidence stores exactly the evidence object passed (approval stamping is a UI concern)", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().setTaskEvidence(projectId, planId, taskId, {
      status: "failed",
      notes: "fails ingest",
    });
    const evidence = useProjectStore.getState().projects[0].plans[0].tasks[0].evidence;
    expect(evidence.status).toBe("failed");
    expect(evidence.notes).toBe("fails ingest");
    expect(evidence.approvedAt).toBeUndefined(); // not stamped by the store
  });

  test("moveTask relocates a task from one plan to another", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    useProjectStore.getState().addPlan(projectId, "Plan B");
    const [planA, planB] = useProjectStore.getState().projects[0].plans;
    useProjectStore.getState().addTask(projectId, planA.id, "Task");
    const taskId = useProjectStore.getState().projects[0].plans[0].tasks[0].id;

    useProjectStore.getState().moveTask(projectId, taskId, planA.id, planB.id);
    const project = useProjectStore.getState().projects[0];
    expect(project.plans.find((p) => p.id === planA.id)!.tasks).toHaveLength(0);
    expect(project.plans.find((p) => p.id === planB.id)!.tasks).toHaveLength(1);
    expect(project.plans.find((p) => p.id === planB.id)!.tasks[0].id).toBe(taskId);
  });

  test("removePlan deletes the plan and its tasks", () => {
    const projectId = useProjectStore.getState().createProject("P");
    useProjectStore.getState().addPlan(projectId, "Plan A");
    const planId = useProjectStore.getState().projects[0].plans[0].id;
    useProjectStore.getState().addTask(projectId, planId, "Task");

    useProjectStore.getState().removePlan(projectId, planId);
    const project = useProjectStore.getState().projects[0];
    expect(project.plans).toHaveLength(0);
  });

  test("deleteProject removes the project", () => {
    const a = useProjectStore.getState().createProject("A");
    const b = useProjectStore.getState().createProject("B");
    useProjectStore.getState().deleteProject(a);
    expect(useProjectStore.getState().projects.map((p) => p.id)).toEqual([b]);
  });

  test("persistence: created project round-trips through localStorage", () => {
    const id = useProjectStore.getState().createProject("Persisted");
    useProjectStore.getState().addPlan(id, "Plan A");
    const raw = window.localStorage.getItem(PERSISTED_PROJECTS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.projects).toHaveLength(1);
    expect(parsed.state.projects[0].id).toBe(id);
    expect(parsed.state.projects[0].plans).toHaveLength(1);
  });
});