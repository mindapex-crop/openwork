/** @jsxImportSource react */
import { Crown, Edit3, Play, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useExpertsStore } from "./experts-store";
import type { ExpertGroup } from "./expert-group-types";

export type ExpertGroupCardLabels = {
  strategyConservative: string;
  strategyBalanced: string;
  strategyAggressive: string;
  membersSuffix: string;
  run: string;
  edit: string;
  delete: string;
};

export type ExpertGroupCardProps = {
  group: ExpertGroup;
  labels: ExpertGroupCardLabels;
  onEdit?: (group: ExpertGroup) => void;
  onDelete?: (group: ExpertGroup) => void;
  onRun?: (group: ExpertGroup) => void;
};

const STRATEGY_STYLES: Record<ExpertGroup["strategy"], { badge: string }> = {
  conservative: { badge: "bg-emerald-500/10 text-emerald-600" },
  balanced: { badge: "bg-amber-500/10 text-amber-600" },
  aggressive: { badge: "bg-violet-500/10 text-violet-600" },
};

export function ExpertGroupCard(props: ExpertGroupCardProps) {
  const { group, labels } = props;
  const experts = useExpertsStore((state) => state.experts);
  const strategyStyle = STRATEGY_STYLES[group.strategy];

  const leader = experts.find((e) => e.id === group.leaderId);
  const memberCount = group.memberIds.length;

  const strategyLabel =
    group.strategy === "conservative"
      ? labels.strategyConservative
      : group.strategy === "aggressive"
        ? labels.strategyAggressive
        : labels.strategyBalanced;

  return (
    <Card
      variant="default"
      size="sm"
      className="h-full transition-colors hover:ring-2 hover:ring-primary/30"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="line-clamp-1 text-sm">{group.name}</CardTitle>
            <Badge variant="outline" className={cn("mt-1 text-[10px]", strategyStyle.badge)}>
              {strategyLabel}
            </Badge>
          </div>
          <div className="flex shrink-0 gap-1">
            {props.onRun ? (
              <ButtonRun group={group} onRun={props.onRun} label={labels.run} />
            ) : null}
            {props.onEdit ? (
              <ButtonEdit group={group} onEdit={props.onEdit} label={labels.edit} />
            ) : null}
            {props.onDelete ? (
              <ButtonDelete group={group} onDelete={props.onDelete} label={labels.delete} />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <CardDescription className="line-clamp-2 leading-relaxed">
          {group.description || "—"}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Crown className="size-3 text-amber-500" />
            <span className="line-clamp-1">{leader?.name ?? group.leaderId}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {memberCount} {labels.membersSuffix}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ButtonRun({ group, onRun, label }: { group: ExpertGroup; onRun: (g: ExpertGroup) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRun(group);
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary/80 hover:bg-primary/10 hover:text-primary"
      aria-label={`${label} ${group.name}`}
      title={label}
    >
      <Play className="size-3.5" />
    </button>
  );
}

function ButtonEdit({ group, onEdit, label }: { group: ExpertGroup; onEdit: (g: ExpertGroup) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onEdit(group);
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={`${label} ${group.name}`}
      title={label}
    >
      <Edit3 className="size-3.5" />
    </button>
  );
}

function ButtonDelete({ group, onDelete, label }: { group: ExpertGroup; onDelete: (g: ExpertGroup) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete(group);
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label={`${label} ${group.name}`}
      title={label}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
