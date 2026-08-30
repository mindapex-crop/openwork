import type { MentionOption } from "./mention-types";

/**
 * "@Terminal" mentions reference a recent command and its output.
 * The value is the command's numeric index in the terminal history.
 */

export interface TerminalHistoryEntry {
  /** 1-based index shown to the user. */
  index: number;
  command: string;
  outputPreview: string;
  timestamp: string;
  exitCode?: number;
}

/** List recent terminal commands as mention options. */
export function listTerminalMentions(entries: TerminalHistoryEntry[]): MentionOption[] {
  return entries.map((entry) => ({
    id: `terminal:${entry.index}`,
    kind: "terminal",
    value: String(entry.index),
    label: entry.command.slice(0, 60),
    description: entry.outputPreview.slice(0, 80).trim() || `exit ${entry.exitCode ?? "?"}`,
    icon: "TerminalSquare",
  }));
}

/** Resolve a terminal mention value to its history entry. */
export function resolveTerminalMention(value: string, entries: TerminalHistoryEntry[]): TerminalHistoryEntry | undefined {
  const index = Number(value);
  return entries.find((entry) => entry.index === index);
}
