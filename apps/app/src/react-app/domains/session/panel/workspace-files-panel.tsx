/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen, Loader2, X } from "lucide-react";

import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 工作空间文件面板（WorkBuddy 右侧"工作空间文件"区对标）：
 * 以树状结构展示当前工作目录，点击文件在产物面板中打开预览。
 * 目录快照由 server /files/sessions/:id/catalog/snapshot 一次性返回。
 */

type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
};

type WorkspaceFilesPanelProps = {
  client: OpenworkServerClient;
  workspaceId: string;
  onOpenFile: (path: string) => void;
  onClose: () => void;
};

function buildTree(entries: Array<{ path: string; kind: "file" | "dir" }>): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "dir", children: [] };
  const nodeByPath = new Map<string, TreeNode>([["", root]]);

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    const segments = entry.path.split("/").filter(Boolean);
    let parent = root;
    let cursor = "";
    for (const segment of segments) {
      cursor = cursor ? `${cursor}/${segment}` : segment;
      let node = nodeByPath.get(cursor);
      if (!node) {
        node = {
          name: segment,
          path: cursor,
          kind: "dir",
          children: [],
        };
        nodeByPath.set(cursor, node);
        parent.children ??= [];
        parent.children.push(node);
      }
      parent = node;
    }
    // 叶子节点：文件（或空的目录条目）落位到其父节点下
    if (segments.length > 0 && entry.kind === "file") {
      const existing = nodeByPath.get(cursor);
      if (existing && existing.kind === "dir") {
        // 同名目录与文件冲突时以目录优先，文件追加为子项
        existing.children ??= [];
        existing.children.push({ name: segments[segments.length - 1]!, path: cursor, kind: "file" });
      } else if (!existing) {
        const fileNode: TreeNode = {
          name: segments[segments.length - 1]!,
          path: cursor,
          kind: "file",
        };
        nodeByPath.set(cursor, fileNode);
        parent.children ??= [];
        parent.children.push(fileNode);
      }
    }
  }
  return root.children ?? [];
}

export function WorkspaceFilesPanel({ client, workspaceId, onOpenFile, onClose }: WorkspaceFilesPanelProps) {
  const [entries, setEntries] = useState<Array<{ path: string; kind: "file" | "dir" }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["", "/"]));

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    if (!client || !workspaceId) return;
    setLoading(true);
    void client.listWorkspaceCatalog(workspaceId)
      .then((items) => {
        if (cancelled) return;
        setEntries(items.map((item) => ({ path: item.path, kind: item.kind })));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "无法读取工作空间目录");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const tree = useMemo(() => (entries ? buildTree(entries) : []), [entries]);

  const toggleDirectory = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const renderNodes = useCallback((nodes: TreeNode[], depth: number): React.ReactNode[] => (
    nodes.map((node) => {
      const isDir = node.kind === "dir";
      const isOpen = expanded.has(node.path);
      return (
        <div key={node.path || node.name}>
          <button
            type="button"
            className={cn(
              "group flex w-full items-center gap-1 rounded-md py-1 text-left text-[13px]",
              "transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => {
              if (isDir) toggleDirectory(node.path);
              else onOpenFile(node.path);
            }}
            title={node.path}
          >
            {isDir ? (
              <>
                <ChevronRight
                  className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                  aria-hidden
                />
                {isOpen ? (
                  <FolderOpen className="size-3.5 shrink-0 text-amber-500/80" aria-hidden />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-amber-500/80" aria-hidden />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" aria-hidden />
                <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </>
            )}
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
          </button>
          {isDir && isOpen && node.children ? (
            <div>{renderNodes(node.children, depth + 1)}</div>
          ) : null}
        </div>
      );
    })
  ), [expanded, onOpenFile, toggleDirectory]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />
          工作空间文件
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭面板" aria-label="关闭面板">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        ) : loading && !entries ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            正在读取工作空间…
          </div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            当前工作空间为空
          </div>
        ) : (
          renderNodes(tree, 0)
        )}
      </div>
    </div>
  );
}
