/** @jsxImportSource react */
import { useMemo, useState } from "react";
import {
  Clock3,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { PlanClarifyDialog } from "./plan-clarify-dialog";
import { PlanCompletionView } from "./plan-completion-view";
import { PlanEditor } from "./plan-editor";
import { PlanExecutionView } from "./plan-execution-view";
import { usePlanStore, usePlans } from "./plan-store";
import { PLAN_PHASE_LABELS, type Plan, type PlanPhase } from "./plan-types";

export type PlanPageProps = {
  onClose?: () => void;
};

type PlanWithTasks = Plan;

const EMPTY = "";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("plan.page.just_now");
  if (diffMin < 60) return t("plan.page.minutes_ago", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("plan.page.hours_ago", { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  return t("plan.page.days_ago", { count: diffDay });
}

function planProgress(plan: PlanWithTasks): number {
  if (plan.tasks.length === 0) return 0;
  const done = plan.tasks.filter((task) => task.status === "completed").length;
  return Math.round((done / plan.tasks.length) * 100);
}

function phaseIcon(phase: PlanPhase) {
  switch (phase) {
    case "clarify":
      return Lightbulb;
    case "draft":
      return Pencil;
    case "edit":
      return Pencil;
    case "execute":
      return Play;
    case "complete":
      return Trophy;
    default:
      return Clock3;
  }
}

function phaseBadgeVariant(phase: PlanPhase): string {
  switch (phase) {
    case "clarify":
      return "bg-blue-2 text-blue-11";
    case "draft":
      return "bg-purple-2 text-purple-11";
    case "edit":
      return "bg-amber-2 text-amber-11";
    case "execute":
      return "bg-orange-2 text-orange-11";
    case "complete":
      return "bg-green-2 text-green-11";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function PlanPage(_props: PlanPageProps) {
  const plans = usePlans();
  const storeDeletePlan = usePlanStore((state) => state.deletePlan);

  const [query, setQuery] = useState<string>(EMPTY);
  const [showClarify, setShowClarify] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [completingPlanId, setCompletingPlanId] = useState<string | null>(null);

  const visiblePlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (!q) return sorted;
    return sorted.filter(
      (plan) =>
        plan.title.toLowerCase().includes(q) || plan.description.toLowerCase().includes(q),
    );
  }, [plans, query]);

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">{t("plan.page.title")}</h1>
          <p className="text-[13px] text-muted-foreground">{t("plan.page.subtitle")}</p>
        </div>
        <Button type="button" size="sm" onClick={() => setShowClarify(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t("plan.page.new_plan")}
        </Button>
      </div>

      {/* Search */}
      {plans.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("plan.page.search_placeholder")}
            className="h-9 ps-9"
          />
        </div>
      )}

      {/* Plan list */}
      <ScrollArea className="flex-1">
        <ScrollAreaViewport>
          {visiblePlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Lightbulb className="mb-3 size-8 text-muted-foreground/40" />
              <p className="text-[14px] font-medium text-foreground">
                {t("plan.page.empty_title")}
              </p>
              <p className="mt-1 max-w-[300px] text-[13px] text-muted-foreground">
                {t("plan.page.empty_description")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={() => setShowClarify(true)}
              >
                <Plus className="me-1.5 size-3.5" />
                {t("plan.page.new_plan")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 pb-6 sm:grid-cols-2">
              {visiblePlans.map((plan) => {
                const PhaseIcon = phaseIcon(plan.phase);
                const progress = planProgress(plan);
                return (
                  <DropdownMenu key={plan.id}>
                    <DropdownMenuTrigger>
                      <Card
                        className="cursor-pointer transition-colors hover:border-border hover:bg-accent/40"
                        onClick={() => setEditingPlanId(plan.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="flex items-center gap-2 truncate text-[14px]">
                                <PhaseIcon className="size-4 shrink-0 text-blue-10" />
                                {plan.title || t("plan.page.untitled")}
                              </CardTitle>
                              <CardDescription className="mt-1 line-clamp-2 text-[12px]">
                                {plan.description || t("plan.page.no_description")}
                              </CardDescription>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={t("plan.page.more_actions")}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingPlanId(plan.id)}>
                                  <Pencil className="me-2 size-3.5" />
                                  {t("plan.page.edit_plan")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setExecutingPlanId(plan.id)}
                                  disabled={plan.tasks.length === 0}
                                >
                                  <Play className="me-2 size-3.5" />
                                  {t("plan.page.execute_plan")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-10 focus:text-red-10"
                                  onClick={() => storeDeletePlan(plan.id)}
                                >
                                  <Trash2 className="me-2 size-3.5" />
                                  {t("plan.page.delete_plan")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] font-medium", phaseBadgeVariant(plan.phase))}
                            >
                              {t(PLAN_PHASE_LABELS[plan.phase])}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(plan.updatedAt)}
                            </span>
                          </div>
                          {plan.tasks.length > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>
                                  {t("plan.page.task_progress", {
                                    done: plan.tasks.filter((task) => task.status === "completed").length,
                                    total: plan.tasks.length,
                                  })}
                                </span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-blue-9 transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setEditingPlanId(plan.id)}>
                        <Pencil className="me-2 size-3.5" />
                        {t("plan.page.edit_plan")}
                      </DropdownMenuItem>
                      {plan.phase === "execute" || plan.phase === "complete" ? (
                        <DropdownMenuItem onClick={() => setCompletingPlanId(plan.id)}>
                          <Trophy className="me-2 size-3.5" />
                          {t("plan.page.view_completion")}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-red-10 focus:text-red-10"
                        onClick={() => storeDeletePlan(plan.id)}
                      >
                        <Trash2 className="me-2 size-3.5" />
                        {t("plan.page.delete_plan")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          )}
        </ScrollAreaViewport>
      </ScrollArea>

      {/* Dialogs */}
      <PlanClarifyDialog
        open={showClarify}
        onOpenChange={setShowClarify}
        onGeneratePlan={() => {
          setShowClarify(false);
          // The clarify dialog already created the plan in the store.
          // Find the newest one by updatedAt and open the editor.
          const all = usePlanStore.getState().plans;
          if (all.length === 0) return;
          const newest = all.reduce((latest, plan) =>
            plan.updatedAt > latest.updatedAt ? plan : latest,
          );
          setEditingPlanId(newest.id);
        }}
      />

      {editingPlanId && (
        <PlanEditor
          planId={editingPlanId}
          open
          onOpenChange={(open) => {
            if (!open) setEditingPlanId(null);
          }}
          onStartExecution={(planId) => {
            setEditingPlanId(null);
            setExecutingPlanId(planId);
          }}
        />
      )}

      {executingPlanId && (
        <PlanExecutionView
          planId={executingPlanId}
          open
          onOpenChange={(open) => {
            if (!open) setExecutingPlanId(null);
          }}
          onComplete={(planId) => {
            setExecutingPlanId(null);
            setCompletingPlanId(planId);
          }}
          onStop={() => {
            setExecutingPlanId(null);
          }}
        />
      )}

      {completingPlanId && (
        <PlanCompletionView
          planId={completingPlanId}
          open
          onOpenChange={(open) => {
            if (!open) setCompletingPlanId(null);
          }}
          onStartNewPlan={() => {
            setCompletingPlanId(null);
            setShowClarify(true);
          }}
          onViewPlan={(planId) => {
            setCompletingPlanId(null);
            setEditingPlanId(planId);
          }}
        />
      )}
    </div>
  );
}

