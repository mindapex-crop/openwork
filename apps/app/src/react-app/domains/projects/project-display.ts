import type { Project } from "./project-store";

export type ProjectListScope = "joined" | "all";

/** "创建于 / 更新于 <date>" label for a project card, matching WorkBuddy cards. */
export function projectCardDateLabel(project: Project): string {
  const date = project.updatedAt || project.createdAt;
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
}

/**
 * Scope filter for the 项目列表 tabs. "我加入的" = projects already bound to a
 * collaboration thread (a real session was started); "全部" = every project.
 * Local-first model, so this is the honest distinction available client-side.
 */
export function filterProjectsByScope(projects: Project[], scope: ProjectListScope): Project[] {
  if (scope === "all") return projects;
  return projects.filter((project) => Boolean(project.threadId));
}
