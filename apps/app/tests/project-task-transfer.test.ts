import { afterEach, describe, expect, test } from "bun:test";

import {
  useProjectStore,
  type TaskDeliverable,
} from "../src/react-app/domains/projects/project-store";

afterEach(() => {
  useProjectStore.setState({ projects: [] });
});

function setupProjectWithPlan(name: string): { projectId: string; planId: string } {
  const store = useProjectStore.getState();
  const projectId = store.createProject(name);
  store.addPlan(projectId, "默认计划");
  const project = useProjectStore.getState().projects.find((p) => p.id === projectId)!;
  const plan = project.plans.find((p) => p.title === "默认计划")!;
  return { projectId, planId: plan.id };
}

describe("project store — G6 task transfer", () => {
  test("packageTaskForTransfer 打包任务交付物与进度摘要", () => {
    const { projectId, planId } = setupProjectWithPlan("源项目");
    const store = useProjectStore.getState();
    store.addTask(projectId, planId, "实现登录功能");

    const task = useProjectStore.getState().projects.find((p) => p.id === projectId)!.plans.find((p) => p.id === planId)!.tasks[0];
    const deliverables: TaskDeliverable[] = [
      { name: "auth.ts", path: "/src/auth.ts", type: "file", createdAt: new Date().toISOString() },
      { name: "login.spec.ts", path: "/tests/login.spec.ts", type: "file", createdAt: new Date().toISOString() },
    ];
    store.setTaskDeliverables(projectId, planId, task.id, deliverables);
    store.setTaskProgressSummary(projectId, planId, task.id, "登录功能已实现，待 review");
    store.setTaskCustomFields(projectId, planId, task.id, { priority: "P0", sprint: "2024-W1" });
    store.addSubtask(projectId, planId, task.id, "写单元测试");
    store.addSubtask(projectId, planId, task.id, "写集成测试");
    const subtaskId = useProjectStore.getState().projects.find((p) => p.id === projectId)!.plans.find((p) => p.id === planId)!.tasks[0].subtasks[0].id;
    store.toggleSubtask(projectId, planId, task.id, subtaskId);

    const pkg = store.packageTaskForTransfer(projectId, planId, task.id);
    expect(pkg).not.toBeNull();
    expect(pkg!.title).toBe("实现登录功能");
    expect(pkg!.deliverables).toHaveLength(2);
    expect(pkg!.progressSummary).toBe("登录功能已实现，待 review");
    expect(pkg!.customFields).toMatchObject({ priority: "P0", sprint: "2024-W1" });
    expect(pkg!.subtaskSummary).toEqual({ total: 2, done: 1 });
  });

  test("transferTask 跨项目转交任务", () => {
    const { projectId: fromProjectId, planId: fromPlanId } = setupProjectWithPlan("源项目");
    const { projectId: toProjectId, planId: toPlanId } = setupProjectWithPlan("目标项目");
    const store = useProjectStore.getState();

    store.addTask(fromProjectId, fromPlanId, "待转交任务");
    const task = useProjectStore.getState().projects.find((p) => p.id === fromProjectId)!.plans.find((p) => p.id === fromPlanId)!.tasks[0];

    const transferred = store.transferTask(fromProjectId, fromPlanId, task.id, toProjectId, toPlanId);
    expect(transferred).toBe(true);

    const afterState = useProjectStore.getState();
    const fromProject = afterState.projects.find((p) => p.id === fromProjectId)!;
    const toProject = afterState.projects.find((p) => p.id === toProjectId)!;
    const fromPlan = fromProject.plans.find((p) => p.id === fromPlanId)!;
    const toPlan = toProject.plans.find((p) => p.id === toPlanId)!;
    expect(fromPlan.tasks).toHaveLength(0);
    expect(toPlan.tasks).toHaveLength(1);
    expect(toPlan.tasks[0].title).toBe("待转交任务");
    expect(toPlan.tasks[0].status).toBe("todo");
  });

  test("transferTask 源项目不存在 → false", () => {
    const store = useProjectStore.getState();
    const result = store.transferTask("nonexistent", "p1", "t1", "p2", "p3");
    expect(result).toBe(false);
  });

  test("setTaskDeliverables / setTaskProgressSummary / setTaskCustomFields 持久化到任务", () => {
    const { projectId, planId } = setupProjectWithPlan("测试项目");
    const store = useProjectStore.getState();
    store.addTask(projectId, planId, "任务");
    const task = useProjectStore.getState().projects.find((p) => p.id === projectId)!.plans.find((p) => p.id === planId)!.tasks[0];
    const taskId = task.id;

    store.setTaskDeliverables(projectId, planId, taskId, [
      { name: "report.pdf", path: "/output/report.pdf", type: "artifact", createdAt: new Date().toISOString() },
    ]);
    store.setTaskProgressSummary(projectId, planId, taskId, "完成 80%");
    store.setTaskCustomFields(projectId, planId, taskId, { env: "staging" });

    const task2 = useProjectStore.getState().projects.find((p) => p.id === projectId)!.plans.find((p) => p.id === planId)!.tasks[0];
    expect(task2.deliverables).toHaveLength(1);
    expect(task2.progressSummary).toBe("完成 80%");
    expect(task2.customFields).toMatchObject({ env: "staging" });
  });
});