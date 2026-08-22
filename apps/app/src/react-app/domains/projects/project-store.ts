/**
 * Projects domain store — a fully local-first model (no backend) inspired by
 * the Work / Milestone / Evidence concepts from catpaw.
 *
 * Everything lives in-memory (Zustand) and is persisted to localStorage via
 * `zustand/middleware/persist`. Evidence is treated as ambient/flightless per
 * the repo's verification culture: it carries only a verdict and notes — never
 * a roll handle.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ProjectStatus = "active" | "paused" | "done";
export type WorkStatus = "todo" | "in_progress" | "review" | "done";
export type EvidenceStatus = "pending" | "passed" | "failed";
export type MilestoneStatus = "open" | "done";

export type Evidence = {
  status: EvidenceStatus;
  notes: string;
};

export type Work = {
  id: string;
  title: string;
  evidence: Evidence;
  status: WorkStatus;
  createdAt: string;
};

export type Milestone = {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  milestones: Milestone[];
  works: Work[];
  createdAt: string;
  updatedAt: string;
};

export const PERSISTED_PROJECTS_KEY = "openwork:projects:v1";
export const PROJECT_WORK_COLUMNS: ReadonlyArray<WorkStatus> = [
  "todo",
  "in_progress",
  "review",
  "done",
];

function now(): string {
  return new Date().toISOString();
}

export type ProjectStore = {
  projects: Project[];
  createProject: (name: string, description?: string) => string;
  updateProject: (projectId: string, patch: Partial<Pick<Project, "name" | "description" | "status">>) => void;
  deleteProject: (projectId: string) => void;
  addMilestone: (projectId: string, title: string, description?: string) => void;
  updateMilestone: (projectId: string, milestoneId: string, patch: Partial<Pick<Milestone, "title" | "description" | "status">>) => void;
  removeMilestone: (projectId: string, milestoneId: string) => void;
  addWork: (projectId: string, title: string) => void;
  updateWorkStatus: (projectId: string, workId: string, status: WorkStatus) => void;
  setWorkEvidence: (projectId: string, workId: string, evidence: Evidence) => void;
  removeWork: (projectId: string, workId: string) => void;
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

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projects: [],

      createProject: (name, description = "") => {
        const id = crypto.randomUUID();
        const timestamp = now();
        const project: Project = {
          id,
          name,
          description,
          status: "active",
          milestones: [],
          works: [],
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

      addMilestone: (projectId, title, description = "") =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            milestones: [
              ...project.milestones,
              {
                id: crypto.randomUUID(),
                title,
                description,
                status: "open",
                createdAt: now(),
              },
            ],
          })),
        ),

      updateMilestone: (projectId, milestoneId, patch) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            milestones: project.milestones.map((milestone) =>
              milestone.id === milestoneId ? { ...milestone, ...patch } : milestone,
            ),
          })),
        ),

      removeMilestone: (projectId, milestoneId) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            milestones: project.milestones.filter((milestone) => milestone.id !== milestoneId),
          })),
        ),

      addWork: (projectId, title) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            works: [
              ...project.works,
              {
                id: crypto.randomUUID(),
                title,
                evidence: { status: "pending", notes: "" },
                status: "todo",
                createdAt: now(),
              },
            ],
          })),
        ),

      updateWorkStatus: (projectId, workId, status) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            works: project.works.map((work) =>
              work.id === workId ? { ...work, status } : work,
            ),
          })),
        ),

      setWorkEvidence: (projectId, workId, evidence) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            works: project.works.map((work) =>
              work.id === workId ? { ...work, evidence } : work,
            ),
          })),
        ),

      removeWork: (projectId, workId) =>
        set((state) =>
          applyProjectMutation(state, projectId, (project) => ({
            ...project,
            works: project.works.filter((work) => work.id !== workId),
          })),
        ),
    }),
    {
      name: PERSISTED_PROJECTS_KEY,
      storage: createJSONStorage(() => localStorage),
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