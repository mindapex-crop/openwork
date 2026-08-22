/** @jsxImportSource react */
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CollabMode } from "../settings/state/feature-flags-preferences";

export type CollabEntryTabProps = {
  /** 进入 /collab-hub（由调用方决定导航或关闭行为）。 */
  onClose: () => void;
  mode: CollabMode;
  className?: string;
};

/**
 * 会话内协作 Tab（方案1，最小实现）。
 *
 * 仅当协作模式为高级模式（collabMode === "cli"）时渲染：在会话页 composer
 * 附近提供一个进入 /collab-hub 的自包含入口；普通模式（simple）下不渲染。
 */
export function CollabEntryTab({ onClose, mode, className }: CollabEntryTabProps) {
  if (mode !== "cli") return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={onClose}
    >
      <Users className="size-3.5" />
      团队协作
    </Button>
  );
}