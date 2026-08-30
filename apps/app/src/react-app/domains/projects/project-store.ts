/**
 * Projects domain store — a fully local-first model (no backend).
 *
 * Function organization follows WorkBuddy: a Project is broken down into
 * Plans (计划), and each Plan owns a set of Tasks (任务). The kanban board
 * (Todo → In progress → Review → Done) and the Proof/Approval evidence
 * model mirror catpaw's Work / Proof / Approval workflow.
 *
 * Everything lives in-memory (Zustand) and is persisted to localStorage via
 * `zustand/middleware/persist`. Evidence is treated as ambient/flightless per
 * the repo's verification culture: it carries only a verdict and notes — never
 * a roll handle.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ProjectStatus = "active" | "paused" | "done";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type EvidenceStatus = "pending" | "passed" | "failed";
export type PlanStatus = "open" | "active" | "done";
export type ActivityCategory = "all" | "mine" | "member" | "automation";

export type ProjectActivityEvent = {
  id: string;
  text: string;
  category: ActivityCategory;
  createdAt: string;
};

export type Evidence = {
  status: EvidenceStatus;
  notes: string;
  approvedBy?: string; // agent/team identity that signed off (WorkBuddy Approval)
  approvedAt?: string;
};

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  evidence: Evidence;
  status: TaskStatus;
  /** WorkBuddy task decomposition — a task can be broken into subtasks. */
  subtasks: Subtask[];
  /** WorkBuddy agent collaboration — the agent/role assigned to this task. */
  assignee?: string;
  createdAt: string;
  /** G6 task transfer — packaged deliverables (files, artifacts). */
  deliverables?: TaskDeliverable[];
  /** G6 task transfer — progress summary for handoff. */
  progressSummary?: string;
  /** G6 task transfer — custom fields for flexible metadata. */
  customFields?: Record<string, string>;
};

export type TaskDeliverable = {
  name: string;
  path: string;
  type: "file" | "artifact" | "link";
  createdAt: string;
};

export type TaskTransferPackage = {
  taskId: string;
  title: string;
  status: TaskStatus;
  deliverables: TaskDeliverable[];
  progressSummary: string;
  customFields: Record<string, string>;
  subtaskSummary: { total: number; done: number };
  packagedAt: string;
};

export type Plan = {
  id: string;
  title: string;
  description: string;
  status: PlanStatus;
  tasks: Task[];
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  plans: Plan[];
  /** Bound skill IDs from SKILL_CATALOG. */
  skills: string[];
  /** Bound expert/agent IDs from experts-store. */
  experts: string[];
  /** Bound connector/MCP server IDs from connections store. */
  connectors: string[];
  /** Command-input activity events. */
  activityEvents: ProjectActivityEvent[];
  /** Bound OpenCode session (thread) id powering the project chatbot. */
  threadId?: string;
  /** Server workspace id the chatbot session runs against. */
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
};

export const PERSISTED_PROJECTS_KEY = "openwork:projects:v2";
export const STORE_VERSION = 4;
export const PROJECT_WORK_COLUMNS: ReadonlyArray<TaskStatus> = [
  "todo",
  "in_progress",
  "review",
  "done",
];

function now(): string {
  return new Date().toISOString();
}

/**
 * Legacy v1 persisted project shape (Milestone / Work were flat on Project).
 * Only used to migrate old localStorage data; never referenced at runtime.
 */
type LegacyV1Project = {
  id: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  milestones?: Array<{
    id: string;
    title: string;
    description?: string;
    status?: string;
    createdAt?: string;
  }>;
  works?: Array<{
    id: string;
    title: string;
    evidence?: Evidence;
    status?: string;
    createdAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

function migrateLegacyProject(project: LegacyV1Project): Project {
  const timestamp = project.createdAt ?? now();
  const plans: Plan[] = (project.milestones ?? []).map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description ?? "",
    status: "open",
    tasks: [],
    createdAt: milestone.createdAt ?? now(),
  }));
  const works = project.works ?? [];
  // Legacy flat work items land in a catch-all "Tasks" plan so none are lost.
  if (works.length > 0) {
    plans.push({
      id: crypto.randomUUID(),
      title: "Tasks",
      description: "",
      status: "open",
      tasks: works.map((work) => ({
        id: work.id,
        title: work.title,
        evidence: work.evidence ?? { status: "pending", notes: "" },
        status: "todo",
        subtasks: [],
        createdAt: work.createdAt ?? now(),
      })),
      createdAt: now(),
    });
  }
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    status: project.status ?? "active",
    plans,
    skills: [],
    experts: [],
    connectors: [],
    activityEvents: [],
    createdAt: timestamp,
    updatedAt: project.updatedAt ?? timestamp,
  };
}

/**
 * A persisted project predates the Plan model when it has no `plans` array
 * (it carried flat `milestones`/`works` instead). Content-sniffing this lets
 * one migration path handle every historical shape without trusting a version.
 */
function isLegacyV1Project(project: Partial<Project> | LegacyV1Project): project is LegacyV1Project {
  return !Array.isArray((project as Partial<Project>).plans);
}

/**
 * The binding arrays (`skills`/`experts`/`connectors`/`activityEvents`) and the
 * nested task fields (`subtasks`/`evidence`) were added to the model after rows
 * already sat in localStorage under the same key, so older rows lack them.
 * Consumers read `task.subtasks.filter` / `task.evidence.status` directly, so we
 * backfill the defaults here — the persistence boundary is the one place
 * untrusted localStorage data is allowed to be normalized.
 */
function normalizeTask(task: Task): Task {
  return {
    ...task,
    status: task.status ?? "todo",
    subtasks: task.subtasks ?? [],
    evidence: task.evidence ?? { status: "pending", notes: "" },
    createdAt: task.createdAt ?? now(),
    deliverables: task.deliverables ?? [],
  };
}

function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    status: plan.status ?? "open",
    description: plan.description ?? "",
    createdAt: plan.createdAt ?? now(),
    tasks: (plan.tasks ?? []).map(normalizeTask),
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    plans: (project.plans ?? []).map(normalizePlan),
    skills: project.skills ?? [],
    experts: project.experts ?? [],
    connectors: project.connectors ?? [],
    activityEvents: project.activityEvents ?? [],
  };
}

export type ProjectStore = {
  projects: Project[];
  createProject: (name: string, description?: string, bindings?: {
    skills?: string[];
    experts?: string[];
    connectors?: string[];
  }) => string;
  updateProject: (projectId: string, patch: Partial<Pick<Project, "name" | "description" | "status">>) => void;
  deleteProject: (projectId: string) => void;
  updateProjectBindings: (projectId: string, bindings: {
    skills?: string[];
    experts?: string[];
    connectors?: string[];
  }) => void;
  setProjectThread: (projectId: string, thread: { threadId: string; workspaceId: string }) => void;
  addActivityEvent: (projectId: string, text: string, category?: ActivityCategory) => void;
  addPlan: (projectId: string, title: string, description?: string) => void;
  updatePlan: (projectId: string, planId: string, patch: Partial<Pick<Plan, "title" | "description" | "status">>) => void;
  removePlan: (projectId: string, planId: string) => void;
  addTask: (projectId: string, planId: string, title: string) => void;
  updateTaskStatus: (projectId: string, planId: string, taskId: string, status: TaskStatus) => void;
  moveTask: (projectId: string, taskId: string, fromPlanId: string, toPlanId: string) => void;
  setTaskEvidence: (projectId: string, planId: string, taskId: string, evidence: Evidence) => void;
  removeTask: (projectId: string, planId: string, taskId: string) => void;
  addSubtask: (projectId: string, planId: string, taskId: string, title: string) => void;
  toggleSubtask: (projectId: string, planId: string, taskId: string, subtaskId: string) => void;
  removeSubtask: (projectId: string, planId: string, taskId: string, subtaskId: string) => void;
  setTaskAssignee: (projectId: string, planId: string, taskId: string, assignee: string) => void;
  setTaskDeliverables: (projectId: string, planId: string, taskId: string, deliverables: TaskDeliverable[]) => void;
  setTaskProgressSummary: (projectId: string, planId: string, taskId: string, summary: string) => void;
  setTaskCustomFields: (projectId: string, planId: string, taskId: string, fields: Record<string, string>) => void;
  packageTaskForTransfer: (projectId: string, planId: string, taskId: string) => TaskTransferPackage | null;
  transferTask: (fromProjectId: string, fromPlanId: string, taskId: string, toProjectId: string, toPlanId: string) => boolean;
};

function applyProjectMutation(
  state: ProjectStore,
  projectId: string,
  mutate: (project: Project) => Project,
): ProjectStore {
  const projects = state.projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }
    const next = mutate({ ...project });
    return { ...next, updatedAt: now() };
  });
  return projects === state.projects ? state : { ...state, projects };
}

function applyPlanMutation(
  state: ProjectStore,
  projectId: string,
  planId: string,
  mutate: (plan: Plan) => Plan,
): ProjectStore {
  return applyProjectMutation(state, projectId, (project) => ({
    ...project,
    plans: project.plans.map((plan) => (plan.id === planId ? mutate({ ...plan }) : plan)),
  }));
}

function applyTaskMutation(
  state: ProjectStore,
  projectId: string,
  planId: string,
  taskId: string,
  mutate: (task: Task) => Task,
): ProjectStore {
  return applyPlanMutation(state, projectId, planId, (plan) => ({
    ...plan,
    tasks: plan.tasks.map((task) => (task.id === taskId ? mutate({ ...task }) : task)),
  }));
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      createProject: (name, description = "", bindings) => {
        const id = crypto.randomUUID();
        const timestamp = now();
        const project: Project = {
          id,
          name,
          description,
          status: "active",
          plans: [],
          skills: bindings?.skills ?? [],
          experts: bindings?.experts ?? [],
          connectors: bindings?.connectors ?? [],
          activityEvents: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({ projects: [...state.projects, project] }));
        return id;
      },

      updateProject: (projectId, patch) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({ ...project, ...patch })),
        ),

      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
        })),

      updateProjectBindings: (projectId, bindings) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            skills: bindings.skills ?? project.skills,
            experts: bindings.experts ?? project.experts,
            connectors: bindings.connectors ?? project.connectors,
          })),
        ),

      setProjectThread: (projectId, thread) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            threadId: thread.threadId,
            workspaceId: thread.workspaceId,
          })),
        ),

      addActivityEvent: (projectId, text, category = "all") =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            activityEvents: [
              { id: crypto.randomUUID(), text, category, createdAt: now() },
              ...project.activityEvents,
            ],
          })),
        ),

      addPlan: (projectId, title, description = "") =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            plans: [
              ...project.plans,
              {
                id: crypto.randomUUID(),
                title,
                description,
                status: "open",
                tasks: [],
                createdAt: now(),
              },
            ],
          })),
        ),

      updatePlan: (projectId, planId, patch) =>
        set((state) => applyPlanMutation(state, projectId, planId, (plan) => ({ ...plan, ...patch }))),

      removePlan: (projectId, planId) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            plans: project.plans.filter((plan) => plan.id !== planId),
          })),
        ),

      addTask: (projectId, planId, title) =>
        set((state) =>
          applyPlanMutation(state, projectId, planId, (plan) => ({
            ...plan,
            tasks: [
              ...plan.tasks,
              {
                id: crypto.randomUUID(),
                title,
                evidence: { status: "pending", notes: "" },
                status: "todo",
                subtasks: [],
                createdAt: now(),
              },
            ],
          })),
        ),

      updateTaskStatus: (projectId, planId, taskId, status) =>
        set((state) =>
          applyPlanMutation(state, projectId, planId, (plan) => ({
            ...plan,
            tasks: plan.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
          })),
        ),

      moveTask: (projectId, taskId, fromPlanId, toPlanId) =>
        set((state) => {
          const source = state.projects
            .find((project) => project.id === projectId)
            ?.plans.find((plan) => plan.id === fromPlanId);
          const movedTask = source?.tasks.find((task) => task.id === taskId) ?? null;
          if (!movedTask) {
            return state;
          }
          const projects = state.projects.map((project) => {
            if (project.id !== projectId) {
              return project;
            }
            let found = false;
            const plans = project.plans.map((plan) => {
              if (plan.id === fromPlanId) {
                found = true;
                return { ...plan, tasks: plan.tasks.filter((task) => task.id !== taskId) };
              }
              if (plan.id === toPlanId) {
                return { ...plan, tasks: [...plan.tasks, movedTask] };
              }
              return plan;
            });
            return { ...project, plans, updatedAt: found ? now() : project.updatedAt };
          });
          return { ...state, projects };
        }),

      setTaskEvidence: (projectId, planId, taskId, evidence) =>
        set((state) =>
          applyPlanMutation(state, projectId, planId, (plan) => ({
            ...plan,
            tasks: plan.tasks.map((task) => (task.id === taskId ? { ...task, evidence } : task)),
          })),
        ),

      removeTask: (projectId, planId, taskId) =>
        set((state) =>
          applyPlanMutation(state, projectId, planId, (plan) => ({
            ...plan,
            tasks: plan.tasks.filter((task) => task.id !== taskId),
          })),
        ),

      addSubtask: (projectId, planId, taskId, title) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({
            ...task,
            subtasks: [
              ...task.subtasks,
              { id: crypto.randomUUID(), title, done: false, createdAt: now() },
            ],
          })),
        ),

      toggleSubtask: (projectId, planId, taskId, subtaskId) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({
            ...task,
            subtasks: task.subtasks.map((subtask) =>
              subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
            ),
          })),
        ),

      removeSubtask: (projectId, planId, taskId, subtaskId) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({
            ...task,
            subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
          })),
        ),

      setTaskAssignee: (projectId, planId, taskId, assignee) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({ ...task, assignee })),
        ),

      setTaskDeliverables: (projectId, planId, taskId, deliverables) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({ ...task, deliverables })),
        ),

      setTaskProgressSummary: (projectId, planId, taskId, summary) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({ ...task, progressSummary: summary })),
        ),

      setTaskCustomFields: (projectId, planId, taskId, fields) =>
        set((state) =>
          applyTaskMutation(state, projectId, planId, taskId, (task) => ({ ...task, customFields: fields })),
        ),

      packageTaskForTransfer: (projectId, planId, taskId) => {
        const state = get();
        const project = state.projects.find((p: Project) => p.id === projectId);
        if (!project) return null;
        const plan = project.plans.find((p: Plan) => p.id === planId);
        if (!plan) return null;
        const task = plan.tasks.find((t: Task) => t.id === taskId);
        if (!task) return null;
        return {
          taskId: task.id,
          title: task.title,
          status: task.status,
          deliverables: task.deliverables ?? [],
          progressSummary: task.progressSummary ?? "",
          customFields: task.customFields ?? {},
          subtaskSummary: {
            total: task.subtasks.length,
            done: task.subtasks.filter((s: Subtask) => s.done).length,
          },
          packagedAt: now(),
        };
      },

      transferTask: (fromProjectId, fromPlanId, taskId, toProjectId, toPlanId) => {
        const state = get();
        const fromProject = state.projects.find((p: Project) => p.id === fromProjectId);
        if (!fromProject) return false;
        const fromPlan = fromProject.plans.find((p: Plan) => p.id === fromPlanId);
        if (!fromPlan) return false;
        const task = fromPlan.tasks.find((t: Task) => t.id === taskId);
        if (!task) return false;
        const toProject = state.projects.find((p: Project) => p.id === toProjectId);
        if (!toProject) return false;
        const toPlan = toProject.plans.find((p: Plan) => p.id === toPlanId);
        if (!toPlan) return false;

        const transferredTask: Task = {
          ...task,
          id: crypto.randomUUID(),
          status: "todo",
          createdAt: now(),
        };

        set((current) => ({
          ...current,
          projects: current.projects.map((project) => {
            if (project.id === toProjectId) {
              return {
                ...project,
                plans: project.plans.map((plan) =>
                  plan.id === toPlanId
                    ? { ...plan, tasks: [...plan.tasks, transferredTask] }
                    : plan,
                ),
                updatedAt: now(),
              };
            }
            if (project.id === fromProjectId) {
              return {
                ...project,
                plans: project.plans.map((plan) =>
                  plan.id === fromPlanId
                    ? { ...plan, tasks: plan.tasks.filter((t) => t.id !== taskId) }
                    : plan,
                ),
                updatedAt: now(),
              };
            }
            return project;
          }),
        }));
        return true;
      },
    }),
    {
      name: PERSISTED_PROJECTS_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: unknown): ProjectStore => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as ProjectStore;
        }
        const state = persistedState as { projects?: unknown };
        if (!Array.isArray(state.projects)) {
          return persistedState as ProjectStore;
        }
        return {
          ...persistedState,
          projects: state.projects.map((project) =>
            normalizeProject(
              isLegacyV1Project(project as LegacyV1Project)
                ? migrateLegacyProject(project as LegacyV1Project)
                : project as Project,
            ),
          ),
        } as ProjectStore;
      },
    },
  ),
);

export function useProjects(): Project[] {
  return useProjectStore((state) => state.projects);
}

export function useProject(projectId: string | null): Project | null {
  return useProjectStore((state) =>
    projectId ? state.projects.find((project) => project.id === projectId) ?? null : null,
  );
}

export function useProjectPlans(projectId: string | null): Plan[] {
  return useProjectStore((state) => {
    if (!projectId) return [];
    const project = state.projects.find((item) => item.id === projectId);
    return project?.plans ?? [];
  });
}