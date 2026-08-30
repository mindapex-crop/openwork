/** @jsxImportSource react */
import { FileDiff, FilePenLine, FilePlus2, FileX2, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FileChange, FileChangeAction } from "../artifacts/open-target";
import { usePanelTabStore } from "./panel-tab-store";

/**
 * 变更面板（WorkBuddy 右侧"变更"区对标）：
 * 记录并展示 AI 对工作空间文件的修改（write/edit/patch/delete），点击文件可在产物面板查看。
 */

type ChangesPanelProps = {
  sessionId: string;
  onOpenFile: (path: string) => void;
  onClose: () => void;
};

const ACTION_LABELS: Record<FileChangeAction, string> = {
  create: "新建",
  edit: "编辑",
  patch: "补丁",
  delete: "删除",
};

const ACTION_ICONS: Record<FileChangeAction, React.ReactNode> = {
  create: <FilePlus2 className="size-3.5" aria-hidden />,
  edit: <FilePenLine className="size-3.5" aria-hidden />,
  patch: <FileDiff className="size-3.5" aria-hidden />,
  delete: <FileX2 className="size-3.5" aria-hidden />,
};

const ACTION_COLORS: Record<FileChangeAction, string> = {
  create: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  edit: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  patch: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function ChangesPanel({ sessionId, onOpenFile, onClose }: ChangesPanelProps) {
  // useShallow：避免 selector 每次返回新数组引用（`?? []`）触发
  // "getSnapshot should be cached" 无限循环，导致整棵 React 树卸载。
  const changes = usePanelTabStore(useShallow(
    (state) => state.transcriptFileChanges[sessionId] ?? [],
  ));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <FileDiff className="size-3.5 text-muted-foreground" aria-hidden />
          变更
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭面板" aria-label="关闭面板">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {changes.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs leading-5 text-muted-foreground">
            暂无变更记录
            <br />
            AI 修改文件后会在这里展示改动对比。
          </div>
        ) : (
          <ul className="space-y-0.5">
            {changes.map((change) => (
              <li key={change.id}>
                <button
                  type="button"
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
                    "transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                  onClick={() => onOpenFile(change.path)}
                  title={change.path}
                >
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      ACTION_COLORS[change.action],
                    )}
                  >
                    {ACTION_ICONS[change.action]}
                    {ACTION_LABELS[change.action]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{basename(change.path)}</span>
                  <span className="shrink-0 truncate text-[10px] text-muted-foreground">{change.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
