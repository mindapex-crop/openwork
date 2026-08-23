/** @jsxImportSource react */
import { useMemo, useState } from "react";
import { FolderKanban, Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { ProjectDetailPanel } from "./project-detail-panel";
import { useProjectStore, useProjects } from "./project-store";
import type { Project, ProjectStatus } from "./project-store";

type ProjectsPageProps = {
  onClose?: () => void;
};

const EMPTY = "";

const statusVariant: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  done: "outline",
};

const statusLabel: Record<ProjectStatus, string> = {
  active: "projects.status_active",
  paused: "projects.status_paused",
  done: "projects.status_done",
};

function countTasks(project: Project): number {
  return project.plans.reduce((total, plan) => total + plan.tasks.length, 0);
}

function countDoneTasks(project: Project): number {
  return project.plans.reduce(
    (total, plan) => total + plan.tasks.filter((task) => task.status === "done").length,
    0,
  );
}

function progress(project: Project): number {
  const total = countTasks(project);
  if (total === 0) {
    return 0;
  }
  return Math.round((countDoneTasks(project) / total) * 100);
}

function recentActivityLabel(project: Project): string {
  const latest = project.plans
    .flatMap((plan) => plan.tasks)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!latest) {
    return t("projects.no_activity");
  }
  return t("projects.last_activity", { title: latest.title });
}

export function ProjectsPage(props: ProjectsPageProps) {
  const projects = useProjects();
  const createProject = useProjectStore((state) => state.createProject);
  const [draftName, setDraftName] = useState<string>(EMPTY);
  const [draftDescription, setDraftDescription] = useState<string>(EMPTY);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState<string>(EMPTY);

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return projects;
    }
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) || project.description.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    const id = createProject(name, draftDescription.trim());
    setDraftName(EMPTY);
    setDraftDescription(EMPTY);
    setSelectedProjectId(id);
  };

  if (selectedProjectId) {
    return (
      <ProjectDetailPanel
        projectId={selectedProjectId}
        onClose={props.onClose}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold">{t("projects.title")}</h2>
        </div>
        <div className="flex items-center gap-1">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={t("common.close")} aria-label={t("common.close")}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-4">
        <Card variant="outline" size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plus size={14} />
              {t("projects.new_project")}
            </CardTitle>
            <CardDescription>{t("projects.new_project_desc")}</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreate();
              }}
              placeholder={t("projects.name_placeholder")}
              className="h-9 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <input
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder={t("projects.desc_placeholder")}
              className="h-9 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div>
              <Button size="sm" onClick={handleCreate} disabled={draftName.trim().length === 0}>
                {t("projects.create")}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {projects.length > 0 ? (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("projects.search_placeholder")}
              className="h-8 w-full rounded-lg border border-border bg-input/50 pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          {visibleProjects.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {query ? t("projects.no_search_results") : t("projects.no_projects")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
              {visibleProjects.map((project) => {
                const totalTasks = countTasks(project);
                const doneTasks = countDoneTasks(project);
                const pct = progress(project);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="group text-left"
                  >
                    <Card
                      className={cn(
                        "h-full transition-colors hover:ring-primary/30",
                        "ring-1 ring-white/5 dark:ring-white/10",
                      )}
                      size="sm"
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="line-clamp-1 text-sm">{project.name}</CardTitle>
                          <Badge variant={statusVariant[project.status]}>
                            {t(statusLabel[project.status])}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {project.description || t("projects.no_description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{t("projects.plans", { count: project.plans.length })}</span>
                          <span>·</span>
                          <span>{t("projects.tasks", { count: totalTasks })}</span>
                          {totalTasks > 0 ? (
                            <>
                              <span>·</span>
                              <span>{t("projects.tasks_done", { count: doneTasks })}</span>
                            </>
                          ) : null}
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                          <span className="line-clamp-1">{recentActivityLabel(project)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}