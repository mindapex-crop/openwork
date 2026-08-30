/**
 * Enhanced session/task types for the task management feature set.
 *
 * Six-state status model plus pinning, archiving, workspace assignment, and
 * sharing. Persisted locally; backend can adopt later.
 */

export type SessionStatus =
  | "in_progress"
  | "completed"
  | "failed"
  | "pending"
  | "planning"
  | "archived";

export const SESSION_STATUSES: SessionStatus[] = [
  "in_progress",
  "completed",
  "failed",
  "pending",
  "planning",
  "archived",
];

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  planning: "Planning",
  archived: "Archived",
};

export const SESSION_STATUS_COLORS: Record<SessionStatus, string> = {
  in_progress: "bg-cyan-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  pending: "bg-amber-500",
  planning: "bg-violet-500",
  archived: "bg-gray-400",
};

export interface SessionMetadata {
  id: string;
  title: string;
  status: SessionStatus;
  pinned: boolean;
  archived: boolean;
  workspaceId?: string;
  shareLink?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messageCount: number;
  model?: string;
  agentId?: string;
}

export type SessionFilterCriteria = {
  statuses: SessionStatus[];
  search: string;
  showArchived: boolean;
  dateRange: "all" | "today" | "week" | "month";
};
