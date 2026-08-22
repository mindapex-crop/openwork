/** @jsxImportSource react */
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Milestone as MilestoneIcon,
  Plus,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  PROJECT_WORK_COLUMNS,
  useProject,
  useProjectStore,
} from "./project-store";
import type { Evidence, EvidenceStatus, Work, WorkStatus } from "./project-store";

type ProjectDetailPanelProps = {
  projectId: string;
  onClose?: () => void;
  onBack?: () => void;
};

const WORK_COLUMN_META: Record<WorkStatus, { label: string; dot: string }> = {
  todo: { label: "Todo", dot: "bg-muted-foreground" },
  in_progress: { label: "In progress", dot: "bg-sky-500" },
  review: { label: "Review", dot: "bg-amber-500" },
  done: { label: "Done", dot: "bg-emerald-500" },
};

const EVIDENCE_META: Record<EvidenceStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  passed: { label: "Passed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

type WorkCardProps = {
  work: Work;
  onStatusChange: (status: WorkStatus) => void;
  onEvidenceChange: (evidence: Evidence) => void;
  onRemove: () => void;
};

function WorkCard({ work, onStatusChange, onEvidenceChange, onRemove }: WorkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(work.evidence.notes);

  const submitEvidence = (status: EvidenceStatus) => {
    onEvidenceChange({ status, notes });
    setExpanded(false);
  };

  return (
    <Card variant="outline" size="sm" className="gap-2">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", WORK_COLUMN_META[work.status].dot)} />
            <span className="text-sm font-medium">{work.title}</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            title="Remove work"
            aria-label="Remove work"
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>

        <Select
          value={work.status}
          onValueChange={(value) => onStatusChange(value as WorkStatus)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_WORK_COLUMNS.map((status) => (
              <SelectItem key={status} value={status}>
                {WORK_COLUMN_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => {
            setExpanded((current) => !current);
            setNotes(work.evidence.notes);
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardCheck size={12} />
            Evidence
          </span>
          <Badge className={cn(EVIDENCE_META[work.evidence.status].className)}>
            {EVIDENCE_META[work.evidence.status].label}
          </Badge>
        </button>

        {expanded ? (
          <div className="space-y-2 border-t border-border pt-2">
            {/* Evidence is ambient and flightless: only a verdict + notes. */}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Evidence notes (no roll handles)"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-input/50 px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["pending", "passed", "failed"] as EvidenceStatus[]).map((status) => (
                <Button
                  key={status}
                  size="xs"
                  variant={work.evidence.status === status ? "default" : "outline"}
                  onClick={() => submitEvidence(status)}
                >
                  {EVIDENCE_META[status].label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ProjectDetailPanel(props: ProjectDetailPanelProps) {
  const project = useProject(props.projectId);
  const updateProjectStatus = useProjectStore((state) => state.updateProject);
  const addMilestone = useProjectStore((state) => state.addMilestone);
  const updateMilestone = useProjectStore((state) => state.updateMilestone);
  const removeMilestone = useProjectStore((state) => state.removeMilestone);
  const addWork = useProjectStore((state) => state.addWork);
  const updateWorkStatus = useProjectStore((state) => state.updateWorkStatus);
  const setWorkEvidence = useProjectStore((state) => state.setWorkEvidence);
  const removeWork = useProjectStore((state) => state.removeWork);

  const [newMilestone, setNewMilestone] = useState("");
  const [newWork, setNewWork] = useState("");

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <span>Project not found.</span>
        {props.onBack ? <Button variant="outline" size="sm" onClick={props.onBack}>Back</Button> : null}
      </div>
    );
  }

  const handleAddMilestone = () => {
    const title = newMilestone.trim();
    if (!title) {
      return;
    }
    addMilestone(project.id, title);
    setNewMilestone("");
  };

  const handleAddWork = () => {
    const title = newWork.trim();
    if (!title) {
      return;
    }
    addWork(project.id, title);
    setNewWork("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {props.onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onBack}
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <h2 className="truncate text-sm font-semibold">{project.name}</h2>
          <Select
            value={project.status}
            onValueChange={(value) => updateProjectStatus(project.id, { status: value as "active" | "paused" | "done" })}
          >
            <SelectTrigger size="sm" className="h-7 gap-1 rounded-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title="Close" aria-label="Close">
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 @4xl:grid-cols-[280px_1fr]">
          {/* Milestones column */}
          <Card variant="outline" size="sm" className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MilestoneIcon size={14} />
                Milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0">
              <div className="mb-2 flex gap-2">
                <input
                  value={newMilestone}
                  onChange={(event) => setNewMilestone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddMilestone();
                    }
                  }}
                  placeholder="Add milestone"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <Button size="icon-sm" variant="outline" onClick={handleAddMilestone} title="Add" aria-label="Add milestone">
                  <Plus size={14} />
                </Button>
              </div>
              <ScrollArea className="h-64 @4xl:h-72">
                <ScrollAreaViewport>
                  <div className="space-y-2 pr-1">
                    {project.milestones.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No milestones yet.</span>
                    ) : null}
                    {project.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {milestone.status === "done" ? (
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                            ) : null}
                            <span className="line-clamp-1">{milestone.title}</span>
                          </div>
                          {milestone.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {milestone.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="xs"
                            variant={milestone.status === "done" ? "outline" : "default"}
                            onClick={() =>
                              updateMilestone(project.id, milestone.id, {
                                status: milestone.status === "done" ? "open" : "done",
                              })
                            }
                          >
                            {milestone.status === "done" ? "Reopen" : "Done"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => removeMilestone(project.id, milestone.id)}
                            title="Remove milestone"
                            aria-label="Remove milestone"
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollAreaViewport>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Work board */}
          <Card variant="outline" size="sm" className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck size={14} />
                Work board
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0">
              <div className="mb-3 flex gap-2">
                <input
                  value={newWork}
                  onChange={(event) => setNewWork(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddWork();
                    }
                  }}
                  placeholder="Add work item"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <Button size="icon-sm" variant="outline" onClick={handleAddWork} title="Add" aria-label="Add work">
                  <Plus size={14} />
                </Button>
              </div>
              <div className="h-80 overflow-x-auto">
                <div className="flex h-full min-w-max gap-3">
                  {PROJECT_WORK_COLUMNS.map((status) => {
                    const works = project.works.filter((work) => work.status === status);
                    return (
                      <div key={status} className="flex w-60 shrink-0 flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", WORK_COLUMN_META[status].dot)} />
                          <span className="text-xs font-medium text-muted-foreground">
                            {WORK_COLUMN_META[status].label}
                          </span>
                          <span className="text-xs text-muted-foreground">{works.length}</span>
                        </div>
                        <ScrollArea className="min-h-0 flex-1">
                          <ScrollAreaViewport className="pr-1">
                            <div className="flex flex-col gap-2">
                              {works.map((work) => (
                                <WorkCard
                                  key={work.id}
                                  work={work}
                                  onStatusChange={(next) => updateWorkStatus(project.id, work.id, next)}
                                  onEvidenceChange={(evidence) => setWorkEvidence(project.id, work.id, evidence)}
                                  onRemove={() => removeWork(project.id, work.id)}
                                />
                              ))}
                            </div>
                          </ScrollAreaViewport>
                        </ScrollArea>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}