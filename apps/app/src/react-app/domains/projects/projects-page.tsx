/** @jsxImportSource react */
import { useState } from "react";
import { CalendarClock, FolderKanban, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { ProjectDetailPanel } from "./project-detail-panel";
import { useProjectStore, useProjects } from "./project-store";
import type { Project, ProjectStatus } from "./project-store";

type ProjectsPageProps = {
  onClose?: () => void;
};

const EMPTY_PROJECT_NAME = "";

const statusBadgeVariant: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  done: "outline",
};

function progress(project: Project): number {
  if (project.works.length === 0) {
    return 0;
  }
  const done = project.works.filter((work) => work.status === "done").length;
  return Math.round((done / project.works.length) * 100);
}

function recentActivityLabel(project: Project): string {
  const latest = project.works.reduce((latestWork, work) =>
    work.createdAt > latestWork.createdAt ? work : latestWork,
  project.works[0]);
  if (!latest) {
    return "No work yet";
  }
  return `Last activity · ${latest.title}`;
}

export function ProjectsPage(props: ProjectsPageProps) {
  const projects = useProjects();
  const createProject = useProjectStore((state) => state.createProject);
  const [draftName, setDraftName] = useState<string>(EMPTY_PROJECT_NAME);
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    const id = createProject(name, draftDescription.trim());
    setDraftName(EMPTY_PROJECT_NAME);
    setDraftDescription("");
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
          <h2 className="text-sm font-semibold">Projects</h2>
        </div>
        <div className="flex items-center gap-1">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title="Close" aria-label="Close">
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
              New project
            </CardTitle>
            <CardDescription>Create a new local project (stored on this device).</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Project name"
              className="h-9 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <input
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder="Description (optional)"
              className="h-9 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div>
              <Button size="sm" onClick={handleCreate} disabled={draftName.trim().length === 0}>
                Create project
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          {projects.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No projects yet. Create your first project above.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
              {projects.map((project) => {
                const doneMilestones = project.milestones.filter(
                  (milestone) => milestone.status === "done",
                ).length;
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
                          <Badge variant={statusBadgeVariant[project.status]}>
                            {project.status}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {project.description || "No description."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{project.milestones.length} milestones</span>
                          <span>·</span>
                          <span>{doneMilestones} done</span>
                          <span>·</span>
                          <span>{project.works.length} works</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                          <CalendarClock size={12} />
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