/** @jsxImportSource react */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Clock3,
  CheckCircle2,
  XCircle,
  Timer,
  Compass,
  Archive,
  Filter,
  RotateCcw,
} from "lucide-react";
import { t } from "../../../i18n";
import { useSessionMetadataStore } from "./session-metadata-store";
import {
  SESSION_STATUSES,
  SESSION_STATUS_LABELS,
  type SessionStatus,
} from "./session-types";

const STATUS_FILTERS: { status: SessionStatus | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: "all", label: "All", icon: Filter },
  { status: "in_progress", label: SESSION_STATUS_LABELS.in_progress, icon: Clock3 },
  { status: "completed", label: SESSION_STATUS_LABELS.completed, icon: CheckCircle2 },
  { status: "failed", label: SESSION_STATUS_LABELS.failed, icon: XCircle },
  { status: "pending", label: SESSION_STATUS_LABELS.pending, icon: Timer },
  { status: "planning", label: SESSION_STATUS_LABELS.planning, icon: Compass },
  { status: "archived", label: SESSION_STATUS_LABELS.archived, icon: Archive },
];

type SessionFilterPanelProps = {
  activeStatuses: SessionStatus[];
  onStatusesChange: (statuses: SessionStatus[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  resultCount: number;
  className?: string;
};

export function SessionFilterPanel({
  activeStatuses,
  onStatusesChange,
  searchQuery,
  onSearchChange,
  showArchived,
  onToggleArchived,
  resultCount,
  className,
}: SessionFilterPanelProps) {
  const [expanded, setExpanded] = React.useState(false);

  const activeFilterCount = activeStatuses.length + (showArchived ? 1 : 0) + (searchQuery ? 1 : 0);

  const toggleStatus = (status: SessionStatus) => {
    if (activeStatuses.includes(status)) {
      onStatusesChange(activeStatuses.filter((s) => s !== status));
    } else {
      onStatusesChange([...activeStatuses, status]);
    }
  };

  const resetFilters = () => {
    onStatusesChange([]);
    onSearchChange("");
    if (showArchived) onToggleArchived();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Filter toggle row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            expanded && "bg-sidebar-accent text-foreground",
          )}
          aria-expanded={expanded}
        >
          <Filter className="size-3.5" />
          {t("session_filters.filters")}
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {t("session_filters.results", { count: resultCount })}
        </span>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-3">
          {/* Search input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.currentTarget.value)}
            placeholder={t("session_filters.search_placeholder")}
            className="h-8 w-full rounded-lg border border-sidebar-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(({ status, label, icon: Icon }) => {
              const isActive = status === "all"
                ? activeStatuses.length === 0
                : activeStatuses.includes(status as SessionStatus);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    if (status === "all") {
                      onStatusesChange([]);
                      if (showArchived) onToggleArchived();
                    } else {
                      toggleStatus(status);
                    }
                  }}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-sidebar-border text-muted-foreground hover:border-primary/20 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Archive toggle + reset */}
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={onToggleArchived}
                className="size-3.5 rounded border-sidebar-border accent-primary"
              />
              {t("session_filters.show_archived")}
            </label>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                {t("session_filters.reset")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
