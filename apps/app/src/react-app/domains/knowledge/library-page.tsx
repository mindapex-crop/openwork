/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, FileCode, FileImage, FileSpreadsheet, FileText, FolderOpen, FolderTree, HardDrive, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { unwrap } from "@/app/lib/opencode";
import type { Client } from "@/app/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { KnowledgePage } from "./knowledge-page";

type LibraryTab = "files" | "knowledge" | "memory";

type LibraryPageProps = {
  onClose?: () => void;
  client?: Client | null;
  workspaceRoot?: string;
  onOpenSettings?: (route: string) => void;
};

type LocalFileEntry = {
  name: string;
  path: string;
};

type FileCategory = {
  id: string;
  label: string;
  icon: typeof FileText;
  extensions: string[];
};

const FILE_CATEGORIES: FileCategory[] = [
  { id: "all", label: "全部文件", icon: FolderOpen, extensions: [] },
  { id: "docs", label: "文档", icon: FileText, extensions: [".md", ".txt", ".doc", ".docx", ".pdf", ".rtf"] },
  { id: "code", label: "代码", icon: FileCode, extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".css", ".html", ".json", ".yaml", ".yml", ".toml", ".sql", ".sh", ".bash"] },
  { id: "data", label: "数据", icon: FileSpreadsheet, extensions: [".csv", ".xlsx", ".xls", ".json", ".xml", ".parquet"] },
  { id: "images", label: "图片", icon: FileImage, extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"] },
];

const TABS: Array<{ id: LibraryTab; labelKey: string }> = [
  { id: "files", labelKey: "library.tab_files" },
  { id: "knowledge", labelKey: "library.tab_knowledge" },
  { id: "memory", labelKey: "library.tab_memory" },
];

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function LibraryPage(props: LibraryPageProps) {
  const [tab, setTab] = useState<LibraryTab>("files");
  const [files, setFiles] = useState<LocalFileEntry[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [fileQuery, setFileQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setFilesLoaded(false);
    const root = props.workspaceRoot?.trim() ?? "";
    if (!props.client || !root) {
      setFiles([]);
      setFilesLoaded(true);
      return;
    }
    void props.client.file
      .list({ directory: root, path: "." })
      .then((result) => {
        if (cancelled) return;
        const entries = unwrap(result);
        const list = Array.isArray(entries)
          ? entries
            .filter((entry) => entry.type === "file")
            .slice(0, 200)
            .map((entry) => ({ name: entry.name, path: entry.path }))
          : [];
        setFiles(list);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setFilesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.client, props.workspaceRoot]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (activeCategory !== "all") {
      const cat = FILE_CATEGORIES.find((c) => c.id === activeCategory);
      if (cat && cat.extensions.length > 0) {
        result = result.filter((f) => cat.extensions.includes(getFileExtension(f.name)));
      }
    }
    const q = fileQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }
    return result;
  }, [files, activeCategory, fileQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    for (const cat of FILE_CATEGORIES) {
      if (cat.id === "all") continue;
      counts[cat.id] = files.filter((f) => cat.extensions.includes(getFileExtension(f.name))).length;
    }
    return counts;
  }, [files]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={t("common.close")} aria-label={t("common.close")}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("library.title")}
        className="flex items-center gap-1 px-4 pb-2"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
              tab === item.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {tab === "files" ? (
        <div className="flex min-h-0 flex-1">
          {/* WorkBuddy 风格侧边分类 */}
          <div className="hidden w-44 shrink-0 border-r border-border md:block">
            <ScrollArea className="h-full">
              <ScrollAreaViewport>
                <div className="space-y-0.5 p-3">
                  <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <FolderTree size={12} />
                    {t("library.tab_files")}
                  </div>
                  {FILE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const count = categoryCounts[cat.id] ?? 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors",
                          activeCategory === cat.id
                            ? "bg-accent text-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <Icon size={14} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{cat.label}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollAreaViewport>
            </ScrollArea>
          </div>

          {/* 文件列表主区域 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* WorkBuddy 风格 Hero */}
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-blue-1/5 via-transparent to-primary/3 mx-4 mt-2 px-5 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-3/10 dark:bg-blue-3/15">
                <HardDrive className="size-5 text-blue-11 dark:text-blue-9" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold text-foreground">{t("library.title")}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("library.files_heading")}
                </p>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="text-center">
                  <div className="text-[16px] font-semibold text-foreground">{files.length}</div>
                  <div className="text-[10px] text-muted-foreground">{t("library.tab_files")}</div>
                </div>
              </div>
            </div>

            {/* 搜索栏 */}
            <div className="relative mx-4 mt-3">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder={t("projects.search_placeholder")}
                className="h-8 w-full rounded-lg border border-border bg-input/50 pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <ScrollAreaViewport>
                <div className="p-4">
                  {filesLoaded && filteredFiles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
                      <FileText size={20} className="mx-auto mb-2 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium text-foreground">{t("library.files_empty")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("library.files_empty_hint")}</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-3 py-2 font-medium text-muted-foreground">{t("library.tab_files")}</th>
                            <th className="hidden px-3 py-2 font-medium text-muted-foreground sm:table-cell">路径</th>
                            <th className="hidden px-3 py-2 font-medium text-muted-foreground md:table-cell">类型</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFiles.map((file) => {
                            const ext = getFileExtension(file.name);
                            return (
                              <tr key={file.path} className="border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/30">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <FileIconForExtension ext={ext} />
                                    <span className="min-w-0 truncate">{file.name}</span>
                                  </div>
                                </td>
                                <td className="hidden px-3 py-2 sm:table-cell">
                                  <span className="truncate text-xs text-muted-foreground">{file.path}</span>
                                </td>
                                <td className="hidden px-3 py-2 md:table-cell">
                                  <Badge variant="outline" className="font-mono text-[10px]">
                                    {ext || "—"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </ScrollAreaViewport>
            </ScrollArea>
          </div>
        </div>
      ) : tab === "knowledge" ? (
        <div className="min-h-0 flex-1">
          <KnowledgePage onClose={props.onClose} />
        </div>
      ) : (
        <MemoryTab onOpenSettings={props.onOpenSettings} />
      )}
    </div>
  );
}

function FileIconForExtension({ ext }: { ext: string }) {
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"].includes(ext)) {
    return <FileCode size={14} className="shrink-0 text-blue-10" />;
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) {
    return <FileImage size={14} className="shrink-0 text-green-10" />;
  }
  if ([".csv", ".xlsx", ".xls", ".json", ".xml"].includes(ext)) {
    return <FileSpreadsheet size={14} className="shrink-0 text-amber-10" />;
  }
  return <FileText size={14} className="shrink-0 text-muted-foreground" />;
}

function MemoryTab({ onOpenSettings }: { onOpenSettings?: (route: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <BrainCircuit size={24} className="text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">{t("library.memory_heading")}</p>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">
        {t("library.memory_placeholder")}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => onOpenSettings?.("/settings/memory")}
      >
        {t("library.memory_open_settings")}
      </Button>
    </div>
  );
}
