/** @jsxImportSource react */
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Trophy,
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
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { usePlanStore } from "./plan-store";
import type { Plan } from "./plan-types";
import type { PlanStore } from "./plan-store";
import type { PlanTask } from "./plan-types";

export type PlanCompletionViewProps = {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user starts a new plan. */
  onStartNewPlan: () => void;
  /** Called when the user wants to reopen the plan editor. */
  onViewPlan: (planId: string) => void;
};

const EMPTY = "";

function buildMarkdown(plan: Plan): string {
  const lines: string[] = [`# ${plan.title}`, EMPTY, plan.description, EMPTY];
  if (plan.requirements.trim()) {
    lines.push("## Requirements", EMPTY, plan.requirements, EMPTY);
  }
  if (plan.technicalApproach.trim() && plan.technicalApproach !== "To be defined during the plan editing phase.") {
    lines.push("## Technical Approach", EMPTY, plan.technicalApproach, EMPTY);
  }
  if (plan.tasks.length > 0) {
    lines.push("## Tasks", EMPTY);
    for (const task of plan.tasks) {
      const checkbox = task.status === "completed" ? "- [x]" : "- [ ]";
      const effortTag = task.estimatedEffort ? ` _(${task.estimatedEffort})_` : EMPTY;
      lines.push(`${checkbox} ${task.title}${effortTag}`);
      if (task.description) {
        lines.push(`  - ${task.description}`);
      }
    }
    lines.push(EMPTY);
  }
  lines.push(`_Generated ${new Date(plan.updatedAt).toLocaleString()}_`);
  return lines.join("\n");
}

export function PlanCompletionView({
  planId,
  open,
  onOpenChange,
  onStartNewPlan,
  onViewPlan,
}: PlanCompletionViewProps) {
  const plan = usePlanStore((state: PlanStore) => state.plans.find((p) => p.id === planId));
  const setPhase = usePlanStore((state: PlanStore) => state.setPhase);

  const [exported, setExported] = useState(false);

  const stats = useMemo(() => {
    if (!plan) return { completed: 0, failed: 0, pending: 0, total: 0 };
    return {
      completed: plan.tasks.filter((t: PlanTask) => t.status === "completed").length,
      failed: plan.tasks.filter((t: PlanTask) => t.status === "failed").length,
      pending: plan.tasks.filter((t: PlanTask) => t.status === "pending" || t.status === "in_progress").length,
      total: plan.tasks.length,
    };
  }, [plan]);

  if (!plan) return null;

  const handleExportMarkdown = () => {
    const markdown = buildMarkdown(plan);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "plan"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const handleRevisitPlan = () => {
    setPhase(planId, "edit");
    onViewPlan(planId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-blue-10" />
            <DialogTitle>{t("plan.completion.title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("plan.completion.subtitle", { title: plan.title })}
          </DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-7/30 bg-green-2/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-green-10">
              <CheckCircle2 className="size-3.5" />
              {t("plan.completion.completed")}
            </div>
            <div className="mt-1 text-[24px] font-semibold text-green-11">{stats.completed}</div>
          </div>
          <div className="rounded-lg border border-red-7/30 bg-red-2/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-red-10">
              <XCircle className="size-3.5" />
              {t("plan.completion.failed")}
            </div>
            <div className="mt-1 text-[24px] font-semibold text-red-11">{stats.failed}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
            <div className="text-[12px] text-muted-foreground">{t("plan.completion.pending")}</div>
            <div className="mt-1 text-[24px] font-semibold text-foreground">{stats.pending}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
            <div className="text-[12px] text-muted-foreground">{t("plan.completion.total")}</div>
            <div className="mt-1 text-[24px] font-semibold text-foreground">{stats.total}</div>
          </div>
        </div>

        {/* Task breakdown */}
        {plan.tasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-foreground">
              {t("plan.completion.task_breakdown")}
            </p>
            <ul className="space-y-1">
              {plan.tasks.map((task) => (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]",
                    task.status === "completed"
                      ? "text-green-10"
                      : task.status === "failed"
                        ? "text-red-10"
                        : "text-muted-foreground",
                  )}
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="size-3.5 shrink-0" />
                  ) : task.status === "failed" ? (
                    <XCircle className="size-3.5 shrink-0" />
                  ) : (
                    <RefreshCw className="size-3.5 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{task.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={handleRevisitPlan}>
              <FileText className="me-1.5 size-3.5" />
              {t("plan.completion.revisit_plan")}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportMarkdown}>
                <Download className="me-1.5 size-3.5" />
                {exported ? t("plan.completion.exported") : t("plan.completion.export_md")}
              </Button>
              <Button type="button" size="sm" onClick={onStartNewPlan}>
                <Plus className="me-1.5 size-3.5" />
                {t("plan.completion.new_plan")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
