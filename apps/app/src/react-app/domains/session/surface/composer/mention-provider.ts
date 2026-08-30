import fuzzysort from "fuzzysort";
import type { ComposerMentionKind } from "./mention-encoding";
import type { MentionGroup, MentionOption } from "./mention-types";
import { listCodeSnippets, searchCodeSnippets } from "./code-mentions";
import { listDocsMentions, searchDocsMentions } from "./docs-mentions";
import type { KnowledgeItem } from "@/react-app/domains/knowledge/knowledge-types";
import type { GitChange, GitCommit } from "./git-mentions";
import { listGitMentions } from "./git-mentions";
import type { TerminalHistoryEntry } from "./terminal-mentions";
import { listTerminalMentions } from "./terminal-mentions";
import type { RuleDefinition } from "./rules-mentions";
import { listRulesMentions } from "./rules-mentions";

/**
 * Unified mention provider: aggregates every mention source, groups them by
 * kind, and supports fuzzy search across all types.
 */

export type MentionProviderData = {
  recentFiles: string[];
  knowledgeItems: KnowledgeItem[];
  gitChanges: GitChange[];
  gitCommits: GitCommit[];
  terminalHistory: TerminalHistoryEntry[];
  rules: RuleDefinition[];
};

const GROUP_LABEL_KEYS: Record<ComposerMentionKind, string> = {
  file: "composer.group_file",
  code: "composer.group_code",
  docs: "composer.group_docs",
  git: "composer.group_git",
  terminal: "composer.group_terminal",
  rules: "composer.group_rules",
  app: "composer.group_app",
  agent: "composer.group_agent",
};

const GROUP_ORDER: readonly ComposerMentionKind[] = [
  "file",
  "code",
  "docs",
  "git",
  "terminal",
  "rules",
  "app",
  "agent",
];

/** Build grouped mention options from all sources. */
export function buildMentionGroups(data: MentionProviderData): MentionGroup[] {
  const allOptions: MentionOption[] = [
    ...listCodeSnippets(data.recentFiles.slice(0, 8)),
    ...listDocsMentions(data.knowledgeItems),
    ...listGitMentions(data.gitChanges, data.gitCommits),
    ...listTerminalMentions(data.terminalHistory.slice(0, 10)),
    ...listRulesMentions(data.rules),
  ];

  const groups = new Map<ComposerMentionKind, MentionOption[]>();
  for (const option of allOptions) {
    const existing = groups.get(option.kind);
    if (existing) existing.push(option);
    else groups.set(option.kind, [option]);
  }

  const result: MentionGroup[] = [];
  for (const kind of GROUP_ORDER) {
    const items = groups.get(kind);
    if (!items || items.length === 0) continue;
    result.push({ kind, labelKey: GROUP_LABEL_KEYS[kind], items });
  }
  return result;
}

/** Flatten grouped options into a single list (preserving group order). */
export function flattenMentionGroups(groups: MentionGroup[]): MentionOption[] {
  return groups.flatMap((group) => group.items);
}

/** Fuzzy-search across all mention options. */
export function searchMentionGroups(groups: MentionGroup[], query: string): MentionGroup[] {
  const normalized = query.trim();
  if (!normalized) return groups;
  const result: MentionGroup[] = [];
  for (const group of groups) {
    const hits = fuzzysort.go(normalized, group.items, { keys: ["label", "description"], limit: 8 });
    if (hits.length === 0) continue;
    result.push({ ...group, items: hits.map((hit) => hit.obj) });
  }
  return result;
}
