/** @jsxImportSource react */
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useExpertsStore } from "./experts-store";
import type { ExpertGroupResult, ExpertGroupMemberStatus } from "./expert-group-types";

export type ExpertGroupResultPanelLabels = {
  resultTitle: string;
  prompt: string;
  startedAt: string;
  endedAt: string;
  synthesis: string;
  statusPending: string;
  statusRunning: string;
  statusCompleted: string;
  statusFailed: string;
  overallCompleted: string;
  overallFailed: string;
  overallRunning: string;
};

export type ExpertGroupResultPanelProps = {
  result: ExpertGroupResult;
  labels: ExpertGroupResultPanelLabels;
};

const STATUS_STYLES: Record<ExpertGroupMemberStatus, { badge: string; icon: typeof Clock }> = {
  pending: { badge: "bg-gray-500/10 text-gray-500", icon: Clock },
  running: { badge: "bg-sky-500/10 text-sky-500", icon: Loader2 },
  completed: { badge: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  failed: { badge: "bg-red-500/10 text-red-600", icon: XCircle },
};

export function ExpertGroupResultPanel(props: ExpertGroupResultPanelProps) {
  const { result, labels } = props;
  const experts = useExpertsStore((state) => state.experts);

  const expertName = (id: string) => experts.find((e) => e.id === id)?.name ?? id;

  const overallBadge =
    result.status === "completed"
      ? "bg-emerald-500/10 text-emerald-600"
      : result.status === "failed"
        ? "bg-red-500/10 text-red-600"
        : "bg-sky-500/10 text-sky-500";

  const overallLabel =
    result.status === "completed"
      ? labels.overallCompleted
      : result.status === "failed"
        ? labels.overallFailed
        : labels.overallRunning;

  const statusLabel = (status: ExpertGroupMemberStatus) =>
    status === "pending"
      ? labels.statusPending
      : status === "running"
        ? labels.statusRunning
        : status === "completed"
          ? labels.statusCompleted
          : labels.statusFailed;

  return (
    <div className="space-y-3">
      <Card variant="outline" size="sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{labels.resultTitle}</CardTitle>
            <Badge variant="outline" className={cn("text-[10px]", overallBadge)}>
              {overallLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {labels.prompt}<span className="text-foreground">{result.prompt}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {labels.startedAt}{result.startedAt}
            {result.completedAt ? ` · ${labels.endedAt}${result.completedAt}` : ""}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {result.members.map((member) => {
          const style = STATUS_STYLES[member.status];
          const Icon = style.icon;
          return (
            <div
              key={member.expertId}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{expertName(member.expertId)}</span>
                <Badge variant="outline" className={cn("text-[10px]", style.badge)}>
                  <Icon className={cn("mr-1 size-3", member.status === "running" && "animate-spin")} />
                  {statusLabel(member.status)}
                </Badge>
              </div>
              {member.output ? (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                  {member.output}
                </p>
              ) : null}
              {member.error ? (
                <p className="mt-1.5 text-xs text-red-500">{member.error}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {result.synthesis ? (
        <Card variant="outline" size="sm" className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{labels.synthesis}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {result.synthesis}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
