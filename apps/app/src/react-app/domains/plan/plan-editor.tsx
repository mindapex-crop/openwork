/** @jsxImportSource react */
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lightbulb,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { usePlanStore } from "./plan-store";
import { PLAN_PHASES, PLAN_PHASE_LABELS } from "./plan-types";
import type { Plan, PlanPhase, PlanTask } from "./plan-types";

export type PlanEditorProps = {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms the plan and wants to start execution. */
  onStartExecution: (planId: string) => void;
};

const EFFORT_OPTIONS: PlanTask["estimatedEffort"][] = ["low", "medium", "high"];

const EMPTY = "";

function effortLabel(effort: PlanTask["estimatedEffort"] | undefined): string {
  if (!effort) return t("plan.editor.effort_none");
  return t(`plan.editor.effort_${effort}`);
}

function effortVariant(effort: PlanTask["estimatedEffort"] | undefined): string {
  if (effort === "high") return "bg-red-2 text-red-11";
  if (effort === "medium") return "bg-amber-2 text-amber-11";
  if (effort === "low") return "bg-green-2 text-green-11";
  return "bg-muted text-muted-foreground";
}

export function PlanEditor({ planId, open, onOpenChange, onStartExecution }: PlanEditorProps) {
  const plan = usePlanStore((state) => state.plans.find((p) => p.id === planId));
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const updateTaskStatus = usePlanStore((state) => state.updateTaskStatus);
  const addTask = usePlanStore((state) => state.addTask);
  const removeTask = usePlanStore((state) => state.removeTask);
  const reorderTasks = usePlanStore((state) => state.reorderTasks);

  const [newTaskTitle, setNewTaskTitle] = useState<string>(EMPTY);
  const [newTaskDescription, setNewTaskDescription] = useState<string>(EMPTY);
  const [newTaskEffort, setNewTaskEffort] = useState<PlanTask["estimatedEffort"]>("medium");

  if (!plan) return null;

  const phaseIndex = PLAN_PHASES.indexOf(plan.phase);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: PlanTask = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: "pending",
      estimatedEffort: newTaskEffort,
    };
    addTask(planId, task);
    setNewTaskTitle(EMPTY);
    setNewTaskDescription(EMPTY);
    setNewTaskEffort("medium");
  };

  const handleMoveTask = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    reorderTasks(planId, index, targetIndex);
  };

  const handleUpdateTaskStatus = (taskId: string, currentStatus: PlanTask["status"]) => {
    const NEXT: Record<PlanTask["status"], PlanTask["status"]> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "failed",
      failed: "pending",
    };
    updateTaskStatus(planId, taskId, NEXT[currentStatus]);
  };

  const statusVariant: Record<PlanTask["status"], string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-2 text-blue-11",
    completed: "bg-green-2 text-green-11",
    failed: "bg-red-2 text-red-11",
  };

  const canStartExecution = plan.tasks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-blue-10" />
            <DialogTitle>{t("plan.editor.title")}</DialogTitle>
          </div>
          <DialogDescription>{t("plan.editor.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* Phase progress indicator */}
        <div className="flex items-center gap-1">
          {PLAN_PHASES.map((phase, index) => (
            <div key={phase} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  index <= phaseIndex ? "bg-blue-9" : "bg-muted",
                )}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {PLAN_PHASES.map((phase) => (
            <span
              key={phase}
              className={cn(
                "flex-1 text-center",
                phase === plan.phase ? "font-medium text-blue-10" : "",
              )}
            >
              {t(PLAN_PHASE_LABELS[phase])}
            </span>
          ))}
        </div>

        {/* Plan details */}
        <div className="space-y-4 overflow-y-auto" style={{ maxHeight: "50vh" }}>
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              {t("plan.editor.plan_title")}
            </label>
            <Input
              value={plan.title}
              onChange={(e) => updatePlan(planId, { title: e.target.value })}
              className="h-9"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              {t("plan.editor.plan_description")}
            </label>
            <Textarea
              value={plan.description}
              onChange={(e) => updatePlan(planId, { description: e.target.value })}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Technical approach */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">
              {t("plan.editor.technical_approach")}
            </label>
            <Textarea
              value={plan.technicalApproach}
              onChange={(e) => updatePlan(planId, { technicalApproach: e.target.value })}
              placeholder={t("plan.editor.technical_approach_placeholder")}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Tasks section */}
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-foreground">
              {t("plan.editor.tasks_label")} ({plan.tasks.length})
            </label>

            {plan.tasks.length > 0 && (
              <ul className="space-y-2">
                {plan.tasks.map((task, index) => (
                  <li
                    key={task.id}
                    className="group flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3"
                  >
                    {/* Drag handle */}
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button
                        type="button"
                        className="text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveTask(index, "up")}
                        disabled={index === 0}
                        aria-label={t("plan.editor.move_up")}
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <GripVertical className="size-3.5 text-muted-foreground/30" />
                      <button
                        type="button"
                        className="text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveTask(index, "down")}
                        disabled={index === plan.tasks.length - 1}
                        aria-label={t("plan.editor.move_down")}
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>

                    {/* Task content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateTaskStatus(task.id, task.status)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                            statusVariant[task.status],
                          )}
                        >
                          {t(`plan.editor.status_${task.status}`)}
                        </button>
                        {task.estimatedEffort && (
                          <Badge variant="outline" className={cn("text-[10px]", effortVariant(task.estimatedEffort))}>
                            {effortLabel(task.estimatedEffort)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] font-medium text-foreground">{task.title}</p>
                      {task.description && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{task.description}</p>
                      )}
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-red-10 group-hover:opacity-100"
                      onClick={() => removeTask(planId, task.id)}
                      aria-label={t("plan.editor.remove_task")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add task form */}
            <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={t("plan.editor.new_task_placeholder")}
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder={t("plan.editor.new_task_description")}
                  rows={1}
                  className="flex-1 resize-none text-[12px]"
                />
                <Select
                  value={newTaskEffort}
                  onValueChange={(v) => setNewTaskEffort(v as PlanTask["estimatedEffort"])}
                >
                  <SelectTrigger className="w-[110px] h-8">
                    <SelectValue placeholder={t("plan.editor.effort_label")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {effortLabel(opt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                >
                  <Plus className="me-1 size-3.5" />
                  {t("plan.editor.add_task")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <span className="text-[12px] text-muted-foreground">
              {t("plan.editor.tasks_count", { count: plan.tasks.length })}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("plan.editor.close")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canStartExecution}
                onClick={() => onStartExecution(planId)}
              >
                <Play className="me-1.5 size-3.5" />
                {t("plan.editor.start_execution")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
