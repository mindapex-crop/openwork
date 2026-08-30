/** @jsxImportSource react */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  FolderPlus,
  Share2,
  Pencil,
  Trash2,
  Copy,
  FolderOpen,
  CheckCircle2,
  Clock3,
  XCircle,
  Timer,
  Compass,
  MoreHorizontal,
} from "lucide-react";
import { t } from "../../../i18n";
import { useSessionMetadataStore } from "./session-metadata-store";
import { copyShareLink } from "./session-share";
import {
  SESSION_STATUSES,
  SESSION_STATUS_LABELS,
  type SessionStatus,
} from "./session-types";

type SessionActionsMenuProps = {
  sessionId: string;
  workspaceId: string;
  initialTitle?: string;
  onRename?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onReveal?: (sessionId: string) => void;
  className?: string;
};

export function SessionActionsMenu({
  sessionId,
  workspaceId,
  onRename,
  onDelete,
  onReveal,
  className,
}: SessionActionsMenuProps) {
  const [copied, setCopied] = React.useState(false);
  const metadata = useSessionMetadataStore((s) => s.metadataById[sessionId]);
  const store = useSessionMetadataStore;

  const isPinned = metadata?.pinned ?? false;
  const isArchived = metadata?.archived ?? false;

  const handleCopyShare = async () => {
    await copyShareLink(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangeStatus = (status: SessionStatus) => {
    store.getState().setSessionStatus(sessionId, status);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-6 text-muted-foreground", className)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="bottom" sideOffset={4} alignOffset={-4} className="w-52">
        {/* Pin / Unpin */}
        <DropdownMenuItem onClick={() => store.getState().togglePin(sessionId)}>
          {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          {isPinned ? t("session_management.unpin_session") : t("session_management.pin_session")}
        </DropdownMenuItem>

        {/* Rename */}
        {onRename ? (
          <DropdownMenuItem onClick={() => onRename(sessionId)}>
            <Pencil className="size-4" />
            {t("workspace_list.rename_session")}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {/* Status submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Clock3 className="size-4" />
            {t("session_actions.set_status")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {SESSION_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleChangeStatus(status)}
                disabled={status === "archived"}
              >
                {status === "in_progress" && <Clock3 className="size-4" />}
                {status === "completed" && <CheckCircle2 className="size-4" />}
                {status === "failed" && <XCircle className="size-4" />}
                {status === "pending" && <Timer className="size-4" />}
                {status === "planning" && <Compass className="size-4" />}
                {status === "archived" && <Archive className="size-4" />}
                {SESSION_STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Save to workspace */}
        <DropdownMenuItem onClick={() => store.getState().saveToWorkspace(sessionId, workspaceId)}>
          <FolderPlus className="size-4" />
          {t("session_actions.save_to_workspace")}
        </DropdownMenuItem>

        {/* Share */}
        <DropdownMenuItem onClick={handleCopyShare}>
          {copied ? <CheckCircle2 className="size-4" /> : <Share2 className="size-4" />}
          {copied ? t("session_actions.link_copied") : t("session_actions.share")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Archive / Unarchive */}
        <DropdownMenuItem onClick={() => store.getState().toggleArchive(sessionId)}>
          {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {isArchived ? t("session_management.unarchive_session") : t("session_management.archive_session")}
        </DropdownMenuItem>

        {/* Open folder */}
        {onReveal ? (
          <DropdownMenuItem onClick={() => onReveal(sessionId)}>
            <FolderOpen className="size-4" />
            {t("session_actions.open_folder")}
          </DropdownMenuItem>
        ) : null}

        {/* Delete */}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(sessionId)}>
              <Trash2 className="size-4" />
              {t("workspace_list.delete_session")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
