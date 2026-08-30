/** @jsxImportSource react */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Copy,
  CheckCircle2,
  Share2,
  Clock3,
  XCircle,
  Timer,
  Compass,
  Archive,
  Bot,
  Hash,
} from "lucide-react";
import { t } from "../../../i18n";
import { useSessionMetadataStore } from "./session-metadata-store";
import { copyShareLink } from "./session-share";
import { SessionStatusBadge } from "./session-status-badge";
import {
  SESSION_STATUSES,
  SESSION_STATUS_LABELS,
  type SessionStatus,
} from "./session-types";

type SessionDetailPanelProps = {
  sessionId: string;
  onClose: () => void;
  className?: string;
};

export function SessionDetailPanel({ sessionId, onClose, className }: SessionDetailPanelProps) {
  const metadata = useSessionMetadataStore((s) => s.metadataById[sessionId]);
  const store = useSessionMetadataStore;
  const [copied, setCopied] = React.useState(false);

  if (!metadata) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground", className)}>
        <p className="text-sm">{t("session_detail.not_found")}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    );
  }

  const handleCopyLink = async () => {
    await copyShareLink(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className={cn("flex flex-col gap-4 overflow-y-auto p-4", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("session_detail.title")}</h3>
        <Button variant="ghost" size="icon-sm" className="size-6 shrink-0" onClick={onClose} aria-label={t("common.close")}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Title (editable) */}
      <label className="grid gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("session_detail.session_title")}
        </span>
        <Input
          value={metadata.title}
          onChange={(e) =>
            store.getState().upsertMetadata({ id: sessionId, title: e.currentTarget.value })
          }
          className="h-8 text-sm"
        />
      </label>

      {/* Status */}
      <label className="grid gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("session_detail.status")}
        </span>
        <Select
          value={metadata.status}
          onValueChange={(value) => store.getState().setSessionStatus(sessionId, value as SessionStatus)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <span className="flex items-center gap-2">
                  <SessionStatusBadge status={status} size="dot" />
                  {SESSION_STATUS_LABELS[status]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {/* Status badge preview */}
      <div className="flex items-center gap-2">
        <SessionStatusBadge status={metadata.status} size="md" />
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/20 p-3">
        <MetadataField
          icon={Hash}
          label={t("session_detail.created")}
          value={formatDate(metadata.createdAt)}
        />
        <MetadataField
          icon={Clock3}
          label={t("session_detail.updated")}
          value={formatDate(metadata.updatedAt)}
        />
        <MetadataField
          icon={Bot}
          label={t("session_detail.agent")}
          value={metadata.agentId ?? "—"}
        />
        <MetadataField
          icon={Hash}
          label={t("session_detail.message_count")}
          value={String(metadata.messageCount)}
        />
      </div>

      {/* Share link */}
      <div className="grid gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("session_detail.share_link")}
        </span>
        <div className="flex items-center gap-2">
          <div className="h-8 flex-1 overflow-hidden rounded-lg border border-sidebar-border bg-background px-3 text-xs text-muted-foreground">
            <span className="block ow-fade-truncate leading-8">
              {metadata.shareLink ?? t("session_detail.no_share_link")}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5"
            onClick={handleCopyLink}
          >
            {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? t("session_actions.link_copied") : t("common.copy")}
          </Button>
        </div>
      </div>

      {/* Pin / Archive actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => store.getState().togglePin(sessionId)}
        >
          {metadata.pinned ? <XCircle className="size-3.5" /> : <Share2 className="size-3.5" />}
          {metadata.pinned ? t("session_management.unpin_session") : t("session_management.pin_session")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => store.getState().toggleArchive(sessionId)}
        >
          {metadata.archived ? <Archive className="size-3.5" /> : <Archive className="size-3.5" />}
          {metadata.archived ? t("session_management.unarchive_session") : t("session_management.archive_session")}
        </Button>
      </div>
    </div>
  );
}

function MetadataField({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</div>
        <div className="ow-fade-truncate text-xs text-foreground">{value}</div>
      </div>
    </div>
  );
}
