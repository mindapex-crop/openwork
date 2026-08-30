import type { MentionOption } from "./mention-types";

/**
 * "@Code" mentions let the user reference a code snippet — a function, class,
 * or line range — from a workspace file. The value encodes the file path plus
 * an optional anchor (e.g. "src/utils/helper.ts#function:formatDate").
 */

export type CodeSnippetKind = "function" | "class" | "lines";

export interface CodeSnippet {
  filePath: string;
  snippetKind: CodeSnippetKind;
  /** Function/class name or "start-end" for line ranges. */
  anchor: string;
}

const ANCHOR_PREFIX: Record<CodeSnippetKind, string> = {
  function: "function:",
  class: "class:",
  lines: "lines:",
};

/** Build the encoded value for a code snippet mention. */
export function encodeCodeSnippet(file: string, snippetKind: CodeSnippetKind, anchor: string): string {
  return `${file}#${ANCHOR_PREFIX[snippetKind]}${anchor}`;
}

/** Parse a code snippet mention value back into its parts. */
export function parseCodeSnippet(value: string): CodeSnippet | null {
  const hashIndex = value.indexOf("#");
  if (hashIndex === -1) return null;
  const filePath = value.slice(0, hashIndex);
  const anchorRaw = value.slice(hashIndex + 1);
  for (const [key, prefix] of Object.entries(ANCHOR_PREFIX) as [CodeSnippetKind, string][]) {
    if (anchorRaw.startsWith(prefix)) {
      return { filePath, snippetKind: key, anchor: anchorRaw.slice(prefix.length) };
    }
  }
  return null;
}

/** Short human-readable label for a code snippet mention pill. */
export function codeSnippetLabel(value: string): string {
  const parsed = parseCodeSnippet(value);
  if (!parsed) return value;
  const fileName = parsed.filePath.split(/[\\/]/).pop() || parsed.filePath;
  if (parsed.snippetKind === "function") return `${fileName}#${parsed.anchor}()`;
  if (parsed.snippetKind === "class") return `${fileName}#${parsed.anchor}`;
  return `${fileName}#${parsed.anchor}`;
}

/**
 * List recently viewed/edited files as code snippet candidates.
 * Falls back to plain file references when no structural index is available.
 */
export function listCodeSnippets(recentFiles: string[]): MentionOption[] {
  return recentFiles.map((filePath) => ({
    id: `code:${filePath}`,
    kind: "code",
    value: filePath,
    label: filePath.split(/[\\/]/).pop() || filePath,
    description: filePath,
    icon: "FileCode",
  }));
}

/** Search files for matching function/class/line patterns. Returns mention options. */
export function searchCodeSnippets(files: string[], query: string): MentionOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return files
    .filter((file) => file.toLowerCase().includes(normalized))
    .map((filePath) => ({
      id: `code:${filePath}`,
      kind: "code",
      value: filePath,
      label: filePath.split(/[\\/]/).pop() || filePath,
      description: filePath,
      icon: "FileCode",
    }));
}
