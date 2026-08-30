import type { ComposerMentionKind } from "./mention-encoding";
import { parseCodeSnippet } from "./code-mentions";
import { resolveDocsMention } from "./docs-mentions";
import type { KnowledgeItem } from "@/react-app/domains/knowledge/knowledge-types";
import type { TerminalHistoryEntry } from "./terminal-mentions";
import { resolveTerminalMention } from "./terminal-mentions";
import type { RuleDefinition } from "./rules-mentions";
import { resolveRulesMention } from "./rules-mentions";

/**
 * Mention context builder: takes resolved mentions and builds the extra text
 * that gets appended to the model prompt so the agent has the referenced
 * content inline.
 */

export type MentionContextData = {
  knowledgeItems: KnowledgeItem[];
  terminalHistory: TerminalHistoryEntry[];
  rules: RuleDefinition[];
};

/** Build context text for a single mention. Returns empty string when no extra context is needed. */
export function buildSingleMentionContext(
  kind: ComposerMentionKind,
  value: string,
  data: MentionContextData,
): string {
  switch (kind) {
    case "code":
      return buildCodeContext(value);
    case "docs":
      return buildDocsContext(value, data.knowledgeItems);
    case "terminal":
      return buildTerminalContext(value, data.terminalHistory);
    case "rules":
      return buildRulesContext(value, data.rules);
    case "git":
      return buildGitContext(value);
    default:
      return "";
  }
}

function buildCodeContext(value: string): string {
  const parsed = parseCodeSnippet(value);
  if (!parsed) return "";
  const fileName = parsed.filePath.split(/[\\/]/).pop() || parsed.filePath;
  const kindLabel =
    parsed.snippetKind === "function"
      ? "the function"
      : parsed.snippetKind === "class"
        ? "the class"
        : "the code at";
  return `\n\n[Referenced code: ${kindLabel} ${parsed.anchor} in ${fileName} (${parsed.filePath})]`;
}

function buildDocsContext(value: string, items: KnowledgeItem[]): string {
  const item = resolveDocsMention(value, items);
  if (!item) return "";
  const content = item.content.slice(0, 2000);
  return `\n\n[Referenced documentation: ${item.title}\n${content}]`;
}

function buildTerminalContext(value: string, entries: TerminalHistoryEntry[]): string {
  const entry = resolveTerminalMention(value, entries);
  if (!entry) return "";
  const output = entry.outputPreview.slice(0, 2000);
  return `\n\n[Referenced terminal command (#${entry.index}): ${entry.command}\nOutput:\n${output}]`;
}

function buildRulesContext(value: string, rules: RuleDefinition[]): string {
  const rule = resolveRulesMention(value, rules);
  if (!rule) return "";
  return `\n\n[Rule "${rule.name}" (${rule.ruleType}): ${rule.description}]`;
}

function buildGitContext(value: string): string {
  if (value === "unstaged") {
    return "\n\n[Referenced: uncommitted (unstaged) changes in the working tree. Run git diff to see details.]";
  }
  if (value === "staged") {
    return "\n\n[Referenced: staged changes. Run git diff --staged to see details.]";
  }
  if (value.startsWith("file:")) {
    const filePath = value.slice(5);
    return `\n\n[Referenced: changes to ${filePath}. Run git diff ${filePath} to see details.]`;
  }
  if (value.startsWith("commit:")) {
    const sha = value.slice(7);
    return `\n\n[Referenced commit: ${sha}. Run git show ${sha} to see details.]`;
  }
  return "";
}

/** Build context for all mentions in a draft. */
export function buildAllMentionContext(
  mentions: Record<string, ComposerMentionKind>,
  data: MentionContextData,
): string {
  const parts: string[] = [];
  for (const [value, kind] of Object.entries(mentions)) {
    const ctx = buildSingleMentionContext(kind, value, data);
    if (ctx) parts.push(ctx);
  }
  return parts.join("");
}
