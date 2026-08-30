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
  type LucideIcon,
} from "lucide-react";
import { SESSION_STATUS_COLORS, SESSION_STATUS_LABELS, type SessionStatus } from "./session-types";

const STATUS_ICONS: Record<SessionStatus, LucideIcon> = {
  in_progress: Clock3,
  completed: CheckCircle2,
  failed: XCircle,
  pending: Timer,
  planning: Compass,
  archived: Archive,
};

const STATUS_TEXT_COLORS: Record<SessionStatus, string> = {
  in_progress: "text-cyan-600 dark:text-cyan-400",
  completed: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  pending: "text-amber-600 dark:text-amber-400",
  planning: "text-violet-600 dark:text-violet-400",
  archived: "text-gray-500 dark:text-gray-400",
};

const STATUS_BG_COLORS: Record<SessionStatus, string> = {
  in_progress: "bg-cyan-500/10 dark:bg-cyan-500/20",
  completed: "bg-emerald-500/10 dark:bg-emerald-500/20",
  failed: "bg-red-500/10 dark:bg-red-500/20",
  pending: "bg-amber-500/10 dark:bg-amber-500/20",
  planning: "bg-violet-500/10 dark:bg-violet-500/20",
  archived: "bg-gray-500/10 dark:bg-gray-500/20",
};

type SessionStatusBadgeProps = {
  status: SessionStatus;
  size?: "dot" | "sm" | "md";
  className?: string;
};

/**
 * Color-coded status indicator for a session.
 * - `dot`: small colored dot (for inline use in sidebar rows)
 * - `sm`: compact badge with icon + label
 * - `md`: full badge with icon + label, more prominent
 */
export function SessionStatusBadge({ status, size = "sm", className }: SessionStatusBadgeProps) {
  if (size === "dot") {
    return (
      <span
        aria-label={SESSION_STATUS_LABELS[status]}
        title={SESSION_STATUS_LABELS[status]}
        className={cn(
          "size-2 shrink-0 rounded-full",
          SESSION_STATUS_COLORS[status],
          className,
        )}
      />
    );
  }

  const Icon = STATUS_ICONS[status];
  const sizeClasses = size === "md"
    ? "h-6 gap-1.5 px-2.5 text-xs"
    : "h-5 gap-1 px-2 text-[11px]";

  return (
    <span
      data-session-status-badge={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap",
        sizeClasses,
        STATUS_TEXT_COLORS[status],
        STATUS_BG_COLORS[status],
        className,
      )}
    >
      <Icon className={size === "md" ? "size-3.5" : "size-3"} />
      {SESSION_STATUS_LABELS[status]}
    </span>
  );
}

/** Minimal colored dot used in the sidebar glyph slot. */
export function SessionStatusDot({ status, className }: SessionStatusBadgeProps) {
  return (
    <span
      aria-label={SESSION_STATUS_LABELS[status]}
      title={SESSION_STATUS_LABELS[status]}
      className={cn(
        "size-2 shrink-0 rounded-full",
        SESSION_STATUS_COLORS[status],
        className,
      )}
    />
  );
}
