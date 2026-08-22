/** @jsxImportSource react */
import * as React from "react";
import { lazy, Suspense, useEffect, useId, useState } from "react";
import { FileText, FolderOpen, Loader2, RefreshCw, X } from "lucide-react";

import {
  desktopFetch,
  openDesktopPath,
} from "@/app/lib/desktop";
import { normalizeLocalFilePath } from "@/app/lib/local-file-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import {
  getFilePreviewState,
  useFilePreviewStore,
  type FilePreviewHandle,
  type FilePreviewKind,
} from "./file-state";

const ArtifactTextEditor = lazy(() =>
  import("../artifacts/artifact-text-editor").then((module) => ({
    default: module.ArtifactTextEditor,
  })),
);

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);
const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".log"]);
const CODE_EXTENSIONS = new Set([
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".scss",
  ".xml",
  ".html",
  ".htm",
  ".go",
  ".py",
  ".rs",
  ".sh",
  ".sql",
]);
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);

function extOf(path: string): string {
  const name = (path.split(/[\\/?#]/).pop() ?? "").toLowerCase();
  return name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
}

function basenameOf(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function classifyFileKind(path: string): FilePreviewKind {
  const ext = extOf(path);
  if (MARKDOWN_EXTENSIONS.has(ext)) return "markdown";
  if (PLAIN_TEXT_EXTENSIONS.has(ext)) return "plain-text";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "unsupported";
}

/**
 * Turn user input (a `file://` URL, an absolute path, or a workspace-relative
 * path) into a fetchable URL. Absolute paths are normalized to `file://` URLs;
 * everything else is passed through as-is so local `openwork-server` file
 * fetching keeps working.
 */
function normalizeInputToUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("file:")) {
    return trimmed;
  }
  if (/^\/[^/]/.test(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

/**
 * Read a resource from disk or a local server. `file://` URLs resolve through
 * the renderer fetch (allowed in the desktop shell where web security is
 * relaxed for local content); every other URL goes through `desktopFetch`, the
 * same mechanism the rest of the app uses to reach the local `openwork-server`.
 */
async function readResource(url: string): Promise<Response> {
  if (/^file:/i.test(url)) {
    return globalThis.fetch(url);
  }
  return desktopFetch(url);
}

async function responseErrorText(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (body.trim()) {
    return body.slice(0, 200);
  }
  return `HTTP ${response.status}`;
}

async function openPreview(input: string): Promise<void> {
  const store = getFilePreviewState();
  const path = normalizeLocalFilePath(input);
  if (!path.trim()) {
    return;
  }

  const name = basenameOf(path);
  const kind = classifyFileKind(path);
  const handle: FilePreviewHandle = { path, name, kind, content: null, objectUrl: null };
  store.openFile(handle);

  if (kind === "unsupported") {
    return;
  }

  const url = normalizeInputToUrl(input);
  store.setLoading(true);
  store.setError(null);

  try {
    const response = await readResource(url);
    if (!response.ok) {
      throw new Error(await responseErrorText(response));
    }

    if (kind === "image") {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      store.setObjectUrl(path, objectUrl);
    } else {
      const text = await response.text();
      store.setContent(path, text);
    }
  } catch (cause) {
    store.setError(cause instanceof Error ? cause.message : "Failed to read file.");
  } finally {
    store.setLoading(false);
  }
}

type FilePreviewTabProps = {
  onClose?: () => void;
};

export function FilePreviewTab({ onClose }: FilePreviewTabProps) {
  const { file, loading, error } = useFilePreviewStore();
  const [pathInput, setPathInput] = useState("");
  const inputId = useId();

  // Release the cached blob URL and reset the store when the panel unmounts.
  useEffect(
    () => () => {
      const current = getFilePreviewState().file;
      if (current?.objectUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(current.objectUrl);
      }
      getFilePreviewState().clear();
    },
    [],
  );

  // Keep the input in sync when a file is opened externally (e.g. refresh).
  useEffect(() => {
    if (file) {
      setPathInput(file.path);
    }
  }, [file]);

  const handleOpen = () => {
    void openPreview(pathInput);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleOpen();
    }
  };

  const handleRefresh = () => {
    if (file) {
      void openPreview(file.path);
    }
  };

  const handleClose = () => {
    getFilePreviewState().clear();
    onClose?.();
  };

  const handleOpenOnDisk = async () => {
    if (!file) {
      return;
    }
    try {
      await openDesktopPath(file.path);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open this file on disk.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-2 mac:bg-background/80 mac:backdrop-blur-2xl mac:backdrop-saturate-150">
        <label className="sr-only" htmlFor={inputId}>
          File path
        </label>
        <Input
          id={inputId}
          className="h-7 flex-1 text-sm"
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入文件路径或 file:// URL"
          spellCheck={false}
          autoComplete="off"
        />
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={handleOpen}
          disabled={loading || !pathInput.trim()}
          aria-label="Open file"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : null}
          打开
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          disabled={!file || loading}
          title="刷新"
          aria-label="Refresh file"
        >
          <RefreshCw className={cn(loading && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleClose}
          title="关闭"
          aria-label="Close file preview"
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!file ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <FileText className="size-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              输入文件路径并点击「打开」以预览文件内容。
            </p>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText className="size-8 text-muted-foreground/60" />
            <p className="max-w-sm text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void handleOpenOnDisk()}>
              <FolderOpen className="size-3" />
              在磁盘打开
            </Button>
          </div>
        ) : (
          <FilePreviewView file={file} onOpenOnDisk={() => void handleOpenOnDisk()} />
        )}
      </div>
    </div>
  );
}

type FilePreviewViewProps = {
  file: FilePreviewHandle;
  onOpenOnDisk: () => void;
};

function FilePreviewView({ file, onOpenOnDisk }: FilePreviewViewProps) {
  if (file.kind === "markdown" || file.kind === "plain-text") {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        }
      >
        <ArtifactTextEditor
          value={file.content ?? ""}
          language={file.kind === "markdown" ? "markdown" : "text"}
          onChange={() => {
            // Read-only preview: the underlying token/type for a real editor is
            // not wired here, so edits are discarded.
          }}
        />
      </Suspense>
    );
  }

  if (file.kind === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-muted/30 p-3">
        {file.objectUrl ? (
          <img src={file.objectUrl} alt={file.name} className="max-h-full max-w-full object-contain" />
        ) : null}
      </div>
    );
  }

  if (file.kind === "code") {
    return (
      <pre className="h-full overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-foreground">
        {file.content ?? ""}
      </pre>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileText className="size-8 text-muted-foreground/60" />
      <p className="max-w-sm text-sm text-muted-foreground">
        暂不支持预览此文件类型，可在磁盘中打开。
      </p>
      <Button variant="outline" size="sm" onClick={onOpenOnDisk}>
        <FolderOpen className="size-3" />
        在磁盘打开
      </Button>
    </div>
  );
}

export default FilePreviewTab;