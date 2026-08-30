/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { usePlanStore } from "./plan-store";
import type { Plan, PlanTask } from "./plan-types";

export type PlanExecutionViewProps = {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when execution completes (all tasks finished or plan stopped). */
  onComplete: (planId: string) => void;
  /** Called when the user stops execution early. */
  onStop?: (planId: string) => void;
};

type ExecutionState = "idle" | "running" | "paused" | "stopped";

const EMPTY = "";

function taskStatusIcon(status: PlanTask["status"], isActive: boolean) {
  if (isActive && status === "in_progress") {
    return <Loader2 className="size-4 animate-spin text-blue-10" />;
  }
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 text-green-10" />;
    case "in_progress":
      return <Loader2 className="size-4 animate-spin text-blue-10" />;
    case "failed":
      return <XCircle className="size-4 text-red-10" />;
    default:
      return <Circle className="size-4 text-muted-foreground/50" />;
  }
}

function taskStatusLabel(status: PlanTask["status"]): string {
  return t(`plan.execution.status_${status}`);
}

export function PlanExecutionView({
  planId,
  open,
  onOpenChange,
  onComplete,
  onStop,
}: PlanExecutionViewProps) {
  const plan = usePlanStore((state) => state.plans.find((p) => p.id === planId));
  const updateTaskStatus = usePlanStore((state) => state.updateTaskStatus);
  const setPhase = usePlanStore((state) => state.setPhase);

  const [executionState, setExecutionState] = useState<ExecutionState>("idle");
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [output, setOutput] = useState<string>(EMPTY);

  const pendingTasks = useMemo(() => {
    if (!plan) return [];
    return plan.tasks.filter((task) => task.status !== "completed" && task.status !== "failed");
  }, [plan]);

  const completedCount = useMemo(() => {
    if (!plan) return 0;
    return plan.tasks.filter((task) => task.status === "completed").length;
  }, [plan]);

  const progressPercent = plan && plan.tasks.length > 0
    ? Math.round((completedCount / plan.tasks.length) * 100)
    : 0;

  // Auto-advance: when current task completes, move to next pending task.
  useEffect(() => {
    if (!plan || executionState !== "running") return;
    const currentTask = plan.tasks[activeTaskIndex];
    if (currentTask && currentTask.status === "completed") {
      const nextPending = plan.tasks.findIndex(
        (task, index) => index > activeTaskIndex && task.status === "pending",
      );
      if (nextPending !== -1) {
        setActiveTaskIndex(nextPending);
        updateTaskStatus(planId, plan.tasks[nextPending].id, "in_progress");
        setOutput((prev) => `${prev}\n\n---\n▶ ${plan.tasks[nextPending].title}\n`);
      } else {
        // All tasks completed
        setPhase(planId, "complete");
        setExecutionState("idle");
        setOutput((prev) => `${prev}\n\n${t("plan.execution.all_done")}`);
        onComplete(planId);
      }
    }
  }, [plan, activeTaskIndex, executionState, planId, updateTaskStatus, setPhase, onComplete]);

  if (!plan) return null;

  const handleStart = () => {
    if (plan.tasks.length === 0) return;
    setPhase(planId, "execute");
    setExecutionState("running");
    // Find the first pending task and mark it as in_progress.
    const firstPending = plan.tasks.findIndex((task) => task.status === "pending");
    const targetIndex = firstPending !== -1 ? firstPending : 0;
    setActiveTaskIndex(targetIndex);
    const targetTask = plan.tasks[targetIndex];
    if (targetTask && targetTask.status === "pending") {
      updateTaskStatus(planId, targetTask.id, "in_progress");
    }
    setOutput(`${t("plan.execution.starting")}\n▶ ${targetTask?.title ?? EMPTY}\n`);
  };

  const handlePause = () => {
    setExecutionState("paused");
  };

  const handleResume = () => {
    setExecutionState("running");
  };

  const handleStop = () => {
    setExecutionState("stopped");
    onStop?.(planId);
  };

  const handleReset = () => {
    for (const task of plan.tasks) {
      updateTaskStatus(planId, task.id, "pending");
    }
    setActiveTaskIndex(0);
    setExecutionState("idle");
    setOutput(EMPTY);
    setPhase(planId, "edit");
  };

  const handleTaskToggle = (task: PlanTask) => {
    const NEXT: Record<PlanTask["status"], PlanTask["status"]> = {
      pending: "completed",
      in_progress: "completed",
      completed: "pending",
      failed: "pending",
    };
    updateTaskStatus(planId, task.id, NEXT[task.status]);
  };

  const controlLabel = (() => {
    switch (executionState) {
      case "running":
        return t("plan.execution.running");
      case "paused":
        return t("plan.execution.paused");
      case "stopped":
        return t("plan.execution.stopped");
      default:
        return t("plan.execution.ready");
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{plan.title}</DialogTitle>
              <DialogDescription>{t("plan.execution.subtitle")}</DialogDescription>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                executionState === "running"
                  ? "bg-blue-2 text-blue-11"
                  : executionState === "paused"
                    ? "bg-amber-2 text-amber-11"
                    : executionState === "stopped"
                      ? "bg-red-2 text-red-11"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {controlLabel}
            </span>
          </div>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {t("plan.execution.progress", { done: completedCount, total: plan.tasks.length })}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Task list */}
        <ScrollArea className="h-[240px]">
          <ScrollAreaViewport>
            <div className="space-y-2 pe-4">
              {plan.tasks.map((task, index) => {
                const isActive = index === activeTaskIndex && executionState === "running";
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-blue-7/50 bg-blue-2/40"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40",
                    )}
                    onClick={() => handleTaskToggle(task)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {taskStatusIcon(task.status, isActive)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px]",
                          task.status === "completed"
                            ? "text-muted-foreground line-through"
                            : "font-medium text-foreground",
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{task.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{taskStatusLabel(task.status)}</span>
                        {task.estimatedEffort && (
                          <span className="text-[11px] text-muted-foreground">
                            • {t(`plan.editor.effort_${task.estimatedEffort}`)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollAreaViewport>
        </ScrollArea>

        {/* Output log */}
        {output && (
          <div className="rounded-lg border border-border/60 bg-black/90 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-green-400/80">
              <Clock className="size-3" />
              {t("plan.execution.output_log")}
            </div>
            <pre className="max-h-[100px] overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-green-400/90">
              {output}
            </pre>
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <span className="text-[12px] text-muted-foreground">
              {pendingTasks.length > 0
                ? t("plan.execution.tasks_remaining", { count: pendingTasks.length })
                : t("plan.execution.all_tasks_done")}
            </span>
            <div className="flex items-center gap-2">
              {executionState === "idle" && (
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="me-1.5 size-3.5" />
                  {t("plan.execution.reset")}
                </Button>
              )}
              {(executionState === "running" || executionState === "paused") && (
                <Button type="button" variant="outline" size="sm" onClick={handleStop}>
                  <Square className="me-1.5 size-3.5" />
                  {t("plan.execution.stop")}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("plan.execution.close")}
              </Button>
              {executionState === "idle" && (
                <Button type="button" size="sm" onClick={handleStart}>
                  <Play className="me-1.5 size-3.5" />
                  {t("plan.execution.start")}
                </Button>
              )}
              {executionState === "paused" && (
                <Button type="button" size="sm" onClick={handleResume}>
                  <Play className="me-1.5 size-3.5" />
                  {t("plan.execution.resume")}
                </Button>
              )}
              {executionState === "running" && (
                <Button type="button" size="sm" onClick={handlePause}>
                  <Pause className="me-1.5 size-3.5" />
                  {t("plan.execution.pause")}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
