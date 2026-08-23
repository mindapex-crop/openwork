/**
 * Pure state-transition logic for the IM connectors panel.
 * Kept separate from the React component so it can be unit-tested without a
 * browser/DOM environment.
 */

export type ImConnectorPlatform = "feishu" | "wecom" | "dingtalk" | "slack" | "discord";
export type ImConnectorStatus = "disconnected" | "connecting" | "connected";

export interface ImConnectorState {
  id: ImConnectorPlatform;
  status: ImConnectorStatus;
  workspace?: string;
  botName?: string;
  lastSyncAt?: string;
}

export const INITIAL_STATES: ImConnectorState[] = [
  { id: "feishu", status: "disconnected" },
  { id: "wecom", status: "disconnected" },
  { id: "dingtalk", status: "disconnected" },
  { id: "slack", status: "disconnected" },
  { id: "discord", status: "disconnected" },
];

/** Requested a connection — transition to `connecting`. */
export function requestConnect(state: ImConnectorState, id: ImConnectorPlatform): ImConnectorState {
  if (state.id !== id) return state;
  if (state.status === "connecting") return state; // idempotent while in-flight
  return { ...state, status: "connecting" };
}

/** Connection completed — transition from `connecting` to `connected`. */
export function completeConnect(state: ImConnectorState, id: ImConnectorPlatform): ImConnectorState {
  if (state.id !== id) return state;
  if (state.status !== "connecting") return state; // cannot complete a non-in-flight connection
  const now = new Date();
  const iso = now.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    ...state,
    status: "connected",
    workspace: id === "feishu" ? "OpenWork 工作区" : "Demo Team",
    botName: "OpenWork Bot",
    lastSyncAt: iso,
  };
}

/** Requested a disconnect — reset to `disconnected`. */
export function requestDisconnect(state: ImConnectorState, id: ImConnectorPlatform): ImConnectorState {
  if (state.id !== id) return state;
  return { id, status: "disconnected" };
}

/** Apply a transition across a full state list. */
export function applyTransition(
  states: ImConnectorState[],
  id: ImConnectorPlatform,
  transition: "connect" | "complete" | "disconnect",
): ImConnectorState[] {
  return states.map((s) => {
    if (transition === "connect") return requestConnect(s, id);
    if (transition === "complete") return completeConnect(s, id);
    if (transition === "disconnect") return requestDisconnect(s, id);
    return s;
  });
}

/** Count connected connectors. */
export function connectedCount(states: ImConnectorState[]): number {
  return states.filter((s) => s.status === "connected").length;
}

import { t } from "@/i18n";

/** Human-readable status label. */
export function formatStatusLabel(status: ImConnectorStatus): string {
  switch (status) {
    case "connected": return t("im_connectors.status_connected");
    case "connecting": return t("im_connectors.status_connecting");
    case "disconnected": return t("im_connectors.status_disconnected");
  }
}

/** Badge tone for status. */
export function formatStatusTone(status: ImConnectorStatus): "default" | "outline" | "secondary" {
  switch (status) {
    case "connected": return "default";
    case "connecting": return "outline";
    case "disconnected": return "secondary";
  }
}