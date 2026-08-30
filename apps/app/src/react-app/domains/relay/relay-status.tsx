/**
 * Relay Sync（接力同步）状态组件（named export RelayStatus）。
 *
 * 展示当前会话的接力同步状态：双方版本 / 待同步数 / 最后同步时间 /
 * relay 事件数，并提供"发起接力"按钮（云下→云上，POST /relay）。
 *
 * 不注册路由不挂载（由集成方接入）；文案使用页面级中英字典，
 * 不触碰全局 i18n。
 */

/** @jsxImportSource react */
import { useEffect } from "react";
import { RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRelaySyncStore } from "./relay-store";

export type RelayStatusProps = {
  /** 当前会话（thread）id。 */
  threadId: string;
  className?: string;
  /** 轮询间隔（毫秒），默认 5000。 */
  pollIntervalMs?: number;
};

/** 页面级中英字典（zh / en），按浏览器语言选择，默认中文。 */
type RelayStatusDictionary = {
  title: string;
  localVersion: string;
  remoteVersion: string;
  pending: string;
  lastSyncedAt: string;
  never: string;
  relayEvents: string;
  relayAction: string;
  relaying: string;
  loading: string;
  error: string;
  retry: string;
  synced: string;
  ahead: string;
  behind: string;
};

const RELAY_STATUS_DICT: { zh: RelayStatusDictionary; en: RelayStatusDictionary } = {
  zh: {
    title: "接力同步",
    localVersion: "本端版本",
    remoteVersion: "对端版本",
    pending: "待同步",
    lastSyncedAt: "最后同步",
    never: "从未",
    relayEvents: "接力事件",
    relayAction: "发起接力",
    relaying: "接力中…",
    loading: "同步状态加载中…",
    error: "状态获取失败",
    retry: "重试",
    synced: "已同步",
    ahead: "有本地待同步内容",
    behind: "已从对端拉取",
  },
  en: {
    title: "Relay Sync",
    localVersion: "Local version",
    remoteVersion: "Remote version",
    pending: "Pending",
    lastSyncedAt: "Last synced",
    never: "Never",
    relayEvents: "Relay events",
    relayAction: "Start relay",
    relaying: "Relaying…",
    loading: "Loading sync status…",
    error: "Failed to load status",
    retry: "Retry",
    synced: "In sync",
    ahead: "Local changes pending",
    behind: "Pulled from remote",
  },
} as const;

function relayDict(): RelayStatusDictionary {
  const language = typeof navigator !== "undefined" ? navigator.language : "";
  return language.toLowerCase().startsWith("zh") ? RELAY_STATUS_DICT.zh : RELAY_STATUS_DICT.en;
}

function formatSyncedAt(timestamp: number | null): string {
  if (timestamp === null) return relayDict().never;
  return new Date(timestamp).toLocaleTimeString();
}

export function RelayStatus({ threadId, className, pollIntervalMs = 5_000 }: RelayStatusProps) {
  const dict = relayDict();
  const status = useRelaySyncStore((state) => state.status);
  const phase = useRelaySyncStore((state) => state.phase);
  const error = useRelaySyncStore((state) => state.error);
  const lastRelayedAt = useRelaySyncStore((state) => state.lastRelayedAt);
  const fetchStatus = useRelaySyncStore((state) => state.fetchStatus);
  const relay = useRelaySyncStore((state) => state.relay);

  useEffect(() => {
    return useRelaySyncStore.getState().startPolling(threadId, pollIntervalMs);
  }, [threadId, pollIntervalMs]);

  const isSyncing = phase === "loading";
  const hasPending = (status?.pendingCount ?? 0) > 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
        className,
      )}
      data-relay-status
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} />
          {dict.title}
          {status && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                hasPending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
              )}
            >
              {hasPending ? dict.ahead : dict.synced}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isSyncing || phase === "error"}
          onClick={() => {
            void relay();
          }}
        >
          <Send className="size-3.5" />
          {dict.relayAction}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span>{dict.localVersion}</span>
        <span className="text-right font-medium text-foreground">{status?.localVersion ?? "—"}</span>
        <span>{dict.remoteVersion}</span>
        <span className="text-right font-medium text-foreground">{status?.remoteVersion ?? "—"}</span>
        <span>{dict.pending}</span>
        <span className="text-right font-medium text-foreground">{status?.pendingCount ?? "—"}</span>
        <span>{dict.relayEvents}</span>
        <span className="text-right font-medium text-foreground">{status?.relayEventCount ?? "—"}</span>
        <span>{dict.lastSyncedAt}</span>
        <span className="text-right font-medium text-foreground">
          {lastRelayedAt !== null ? formatSyncedAt(lastRelayedAt) : formatSyncedAt(status?.lastSyncedAt ?? null)}
        </span>
      </div>

      {phase === "error" && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-destructive">
          <span className="truncate">
            {error ? `${dict.error}: ${error}` : dict.error}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void fetchStatus();
            }}
          >
            {dict.retry}
          </Button>
        </div>
      )}
    </div>
  );
}
