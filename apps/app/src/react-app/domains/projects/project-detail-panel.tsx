/** @jsxImportSource react */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  LayoutList,
  ListChecks,
  Plus,
  Trash2,
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
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import {
  PROJECT_WORK_COLUMNS,
  useProject,
  useProjectStore,
} from "./project-store";
import type { Evidence, EvidenceStatus, Plan, PlanStatus, Task, TaskStatus } from "./project-store";

type ProjectDetailPanelProps = {
  projectId: string;
  onClose?: () => void;
  onBack?: () => void;
};

const TASK_COLUMN_META: Record<TaskStatus, { key: string; dot: string }> = {
  todo: { key: "projects.col_todo", dot: "bg-muted-foreground" },
  in_progress: { key: "projects.col_in_progress", dot: "bg-sky-500" },
  review: { key: "projects.col_review", dot: "bg-amber-500" },
  done: { key: "projects.col_done", dot: "bg-emerald-500" },
};

const EVIDENCE_META: Record<EvidenceStatus, { key: string; className: string }> = {
  pending: { key: "projects.evidence_pending", className: "bg-muted text-muted-foreground" },
  passed: { key: "projects.evidence_passed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { key: "projects.evidence_failed", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

type TaskCardProps = {
  task: Task;
  planId: string;
  projectPlans: Plan[];
  onStatusChange: (status: TaskStatus) => void;
  onEvidenceChange: (evidence: Evidence) => void;
  onMove: (toPlanId: string) => void;
  onRemove: () => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onRemoveSubtask: (subtaskId: string) => void;
  onAssigneeChange: (assignee: string) => void;
  onDragStart: () => void;
};

function TaskCard({
  task,
  planId,
  projectPlans,
  onStatusChange,
  onEvidenceChange,
  onMove,
  onRemove,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
  onAssigneeChange,
  onDragStart,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(task.evidence.notes);
  const [newSubtask, setNewSubtask] = useState("");

  const submitEvidence = (status: EvidenceStatus) => {
    onEvidenceChange({
      status,
      notes,
      ...(status === "passed" && !task.evidence.approvedAt
        ? { approvedAt: new Date().toISOString() }
        : {}),
    });
    setExpanded(false);
  };

  const otherPlans = projectPlans.filter((plan) => plan.id !== planId);
  const doneSubtaskCount = task.subtasks.filter((subtask) => subtask.done).length;

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    onAddSubtask(title);
    setNewSubtask("");
  };

  return (
    <Card
      variant="outline"
      size="sm"
      draggable
      onDragStart={onDragStart}
      className="cursor-grab gap-2 active:cursor-grabbing"
    >
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TASK_COLUMN_META[task.status].dot)} />
            <span className="text-sm font-medium">{task.title}</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            title={t("projects.remove_task")}
            aria-label={t("projects.remove_task")}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>

        <Select value={task.status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_WORK_COLUMNS.map((status) => (
              <SelectItem key={status} value={status}>
                {t(TASK_COLUMN_META[status].key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assignee — WorkBuddy agent collaboration */}
        <input
          value={task.assignee ?? ""}
          onChange={(event) => onAssigneeChange(event.target.value)}
          placeholder={t("projects.assignee_placeholder")}
          className="h-7 w-full rounded-lg border border-border bg-input/50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />

        {/* Subtasks — WorkBuddy task decomposition */}
        {task.subtasks.length > 0 ? (
          <div className="space-y-1">
            {task.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onToggleSubtask(subtask.id)}
                  aria-label={t("projects.toggle_subtask")}
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    subtask.done ? "border-emerald-500 bg-emerald-500/20" : "border-border",
                  )}
                >
                  {subtask.done ? <CheckCircle2 size={10} className="text-emerald-500" /> : null}
                </button>
                <span className={cn("min-w-0 flex-1", subtask.done && "text-muted-foreground line-through")}>
                  {subtask.title}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSubtask(subtask.id)}
                  title={t("projects.remove_subtask")}
                  aria-label={t("projects.remove_subtask")}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <input
            value={newSubtask}
            onChange={(event) => setNewSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            placeholder={t("projects.add_subtask")}
            className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button size="icon-sm" variant="outline" onClick={addSubtask} disabled={newSubtask.trim().length === 0} title={t("projects.add_subtask")} aria-label={t("projects.add_subtask")}>
            <Plus size={12} />
          </Button>
        </div>
        {task.subtasks.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("projects.subtasks_done", { done: doneSubtaskCount, total: task.subtasks.length })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setExpanded((current) => !current);
            setNotes(task.evidence.notes);
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardCheck size={12} />
            {t("projects.evidence")}
          </span>
          <Badge className={cn(EVIDENCE_META[task.evidence.status].className)}>
            {t(EVIDENCE_META[task.evidence.status].key)}
          </Badge>
        </button>

        {expanded ? (
          <div className="space-y-2 border-t border-border pt-2">
            {/* Evidence is ambient and flightless: only a verdict + notes. */}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("projects.evidence_notes_placeholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-input/50 px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["pending", "passed", "failed"] as EvidenceStatus[]).map((status) => (
                <Button
                  key={status}
                  size="xs"
                  variant={task.evidence.status === status ? "default" : "outline"}
                  onClick={() => submitEvidence(status)}
                >
                  {t(EVIDENCE_META[status].key)}
                </Button>
              ))}
            </div>
            {task.evidence.approvedAt ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {t("projects.evidence_approved_at", { date: new Date(task.evidence.approvedAt).toLocaleString() })}
                {task.evidence.approvedBy ? ` · ${task.evidence.approvedBy}` : ""}
              </p>
            ) : null}
            {otherPlans.length > 0 ? (
              <Select onValueChange={(value) => onMove(value as string)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={t("projects.move_task_to")} />
                </SelectTrigger>
                <SelectContent>
                  {otherPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type PlanCardProps = {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Pick<Plan, "status">>) => void;
  onRemove: () => void;
};

function PlanCard({ plan, selected, onSelect, onUpdate, onRemove }: PlanCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-lg border px-2.5 py-2 transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {plan.status === "done" ? (
              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
            ) : null}
            <span className="line-clamp-1">{plan.title}</span>
          </div>
          {plan.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{plan.description}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("projects.tasks", { count: plan.tasks.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title={t("projects.remove_plan")}
          aria-label={t("projects.remove_plan")}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-1.5">
        <Select
          value={plan.status}
          onValueChange={(value) => onUpdate({ status: value as PlanStatus })}
        >
          <SelectTrigger size="sm" className="h-7 gap-1 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("projects.plan_open")}</SelectItem>
            <SelectItem value="active">{t("projects.plan_active")}</SelectItem>
            <SelectItem value="done">{t("projects.plan_done")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ProjectDetailPanel(props: ProjectDetailPanelProps) {
  const project = useProject(props.projectId);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const addPlan = useProjectStore((state) => state.addPlan);
  const updatePlan = useProjectStore((state) => state.updatePlan);
  const removePlan = useProjectStore((state) => state.removePlan);
  const addTask = useProjectStore((state) => state.addTask);
  const updateTaskStatus = useProjectStore((state) => state.updateTaskStatus);
  const moveTask = useProjectStore((state) => state.moveTask);
  const setTaskEvidence = useProjectStore((state) => state.setTaskEvidence);
  const removeTask = useProjectStore((state) => state.removeTask);
  const addSubtask = useProjectStore((state) => state.addSubtask);
  const toggleSubtask = useProjectStore((state) => state.toggleSubtask);
  const removeSubtask = useProjectStore((state) => state.removeSubtask);
  const setTaskAssignee = useProjectStore((state) => state.setTaskAssignee);

  const [newPlan, setNewPlan] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newTask, setNewTask] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (project && !project.plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(project.plans[0]?.id ?? null);
    }
  }, [project, selectedPlanId]);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <span>{t("projects.project_not_found")}</span>
        {props.onBack ? (
          <Button variant="outline" size="sm" onClick={props.onBack}>
            {t("common.back")}
          </Button>
        ) : null}
      </div>
    );
  }

  const selectedPlan = project.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const handleAddPlan = () => {
    const title = newPlan.trim();
    if (!title) {
      return;
    }
    const projectId = project.id;
    addPlan(projectId, title, newPlanDesc.trim());
    setNewPlan("");
    setNewPlanDesc("");
  };

  const handleAddTask = () => {
    const title = newTask.trim();
    if (!selectedPlan || !title) {
      return;
    }
    addTask(project.id, selectedPlan.id, title);
    setNewTask("");
  };

  const handleDeleteProject = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteProject(project.id);
    setConfirmDelete(false);
    props.onBack?.();
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
              title={t("common.back")}
              aria-label={t("common.back")}
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <h2 className="truncate text-sm font-semibold">{project.name}</h2>
          <Select
            value={project.status}
            onValueChange={(value) => updateProject(project.id, { status: value as "active" | "paused" | "done" })}
          >
            <SelectTrigger size="sm" className="h-7 gap-1 rounded-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("projects.status_active")}</SelectItem>
              <SelectItem value="paused">{t("projects.status_paused")}</SelectItem>
              <SelectItem value="done">{t("projects.status_done")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDeleteProject}
            title={t("projects.delete_project")}
            aria-label={t("projects.delete_project")}
            className={cn(confirmDelete && "text-destructive")}
          >
            <Trash2 size={14} />
          </Button>
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={t("common.close")} aria-label={t("common.close")}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 @4xl:grid-cols-[280px_1fr]">
          {/* Plans column */}
          <Card variant="outline" size="sm" className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <LayoutList size={14} />
                {t("projects.plans_title")}
              </CardTitle>
              <CardDescription>{t("projects.plans_title_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0">
              <div className="mb-2 flex flex-col gap-2">
                <input
                  value={newPlan}
                  onChange={(event) => setNewPlan(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddPlan();
                  }}
                  placeholder={t("projects.add_plan")}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <input
                  value={newPlanDesc}
                  onChange={(event) => setNewPlanDesc(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddPlan();
                  }}
                  placeholder={t("projects.plan_desc_placeholder")}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <Button size="sm" variant="outline" onClick={handleAddPlan} disabled={newPlan.trim().length === 0}>
                  <Plus size={14} className="mr-1" />
                  {t("projects.add_plan")}
                </Button>
              </div>
              <ScrollArea className="h-[32rem] @4xl:h-[36rem]">
                <ScrollAreaViewport>
                  <div className="space-y-2 pr-1">
                    {project.plans.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t("projects.no_plans")}</span>
                    ) : null}
                    {project.plans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        selected={plan.id === selectedPlanId}
                        onSelect={() => setSelectedPlanId(plan.id)}
                        onUpdate={(patch) => updatePlan(project.id, plan.id, patch)}
                        onRemove={() => removePlan(project.id, plan.id)}
                      />
                    ))}
                  </div>
                </ScrollAreaViewport>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Task board for the selected plan */}
          <Card variant="outline" size="sm" className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListChecks size={14} />
                {selectedPlan
                  ? t("projects.board_for_plan", { plan: selectedPlan.title })
                  : t("projects.board_title")}
              </CardTitle>
              <CardDescription>{t("projects.board_title_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0">
              {!selectedPlan ? (
                <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <ListChecks size={20} />
                  <span>{t("projects.no_plans_hint")}</span>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex gap-2">
                    <input
                      value={newTask}
                      onChange={(event) => setNewTask(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleAddTask();
                      }}
                      placeholder={t("projects.task_placeholder")}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    />
                    <Button size="icon-sm" variant="outline" onClick={handleAddTask} disabled={newTask.trim().length === 0} title={t("projects.add_task")} aria-label={t("projects.add_task")}>
                      <Plus size={14} />
                    </Button>
                  </div>
                  <div className="h-[30rem] @4xl:h-[34rem] overflow-x-auto">
                    <div className="flex h-full min-w-max gap-3">
                      {PROJECT_WORK_COLUMNS.map((status) => {
                        const tasks = selectedPlan.tasks.filter((task) => task.status === status);
                        return (
                          <div
                            key={status}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setDragOverColumn(status);
                            }}
                            onDragLeave={() => {
                              setDragOverColumn((current) => (current === status ? null : current));
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (dragTaskId) {
                                updateTaskStatus(project.id, selectedPlan.id, dragTaskId, status);
                              }
                              setDragTaskId(null);
                              setDragOverColumn(null);
                            }}
                            className={cn(
                              "flex w-60 shrink-0 flex-col gap-2 rounded-xl transition-colors",
                              dragOverColumn === status && "bg-primary/5 ring-1 ring-primary/30",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("size-2 rounded-full", TASK_COLUMN_META[status].dot)} />
                              <span className="text-xs font-medium text-muted-foreground">
                                {t(TASK_COLUMN_META[status].key)}
                              </span>
                              <span className="text-xs text-muted-foreground">{tasks.length}</span>
                            </div>
                            <ScrollArea className="min-h-0 flex-1 rounded-lg">
                              <ScrollAreaViewport className="pr-1">
                                <div className="flex flex-col gap-2">
                                  {tasks.map((task) => (
                                    <TaskCard
                                      key={task.id}
                                      task={task}
                                      planId={selectedPlan.id}
                                      projectPlans={project.plans}
                                      onStatusChange={(next) =>
                                        updateTaskStatus(project.id, selectedPlan.id, task.id, next)
                                      }
                                      onEvidenceChange={(evidence) =>
                                        setTaskEvidence(project.id, selectedPlan.id, task.id, evidence)
                                      }
                                      onMove={(toPlanId) =>
                                        moveTask(project.id, task.id, selectedPlan.id, toPlanId)
                                      }
                                      onRemove={() => removeTask(project.id, selectedPlan.id, task.id)}
                                      onAddSubtask={(title) =>
                                        addSubtask(project.id, selectedPlan.id, task.id, title)
                                      }
                                      onToggleSubtask={(subtaskId) =>
                                        toggleSubtask(project.id, selectedPlan.id, task.id, subtaskId)
                                      }
                                      onRemoveSubtask={(subtaskId) =>
                                        removeSubtask(project.id, selectedPlan.id, task.id, subtaskId)
                                      }
                                      onAssigneeChange={(assignee) =>
                                        setTaskAssignee(project.id, selectedPlan.id, task.id, assignee)
                                      }
                                      onDragStart={() => setDragTaskId(task.id)}
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}