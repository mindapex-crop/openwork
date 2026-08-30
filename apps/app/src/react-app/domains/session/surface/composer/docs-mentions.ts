import type { KnowledgeItem } from "@/react-app/domains/knowledge/knowledge-types";
import type { MentionOption } from "./mention-types";

/**
 * "@Docs" mentions reference items from the local knowledge base.
 * The value is the knowledge item's id (stable across renames).
 */

/** List all knowledge items as mention options. */
export function listDocsMentions(items: KnowledgeItem[]): MentionOption[] {
  return items.map((item) => ({
    id: `docs:${item.id}`,
    kind: "docs",
    value: item.id,
    label: item.title,
    description: item.description || item.content.slice(0, 80).trim(),
    icon: "BookOpen",
  }));
}

/** Fuzzy-filter knowledge items by title or description. */
export function searchDocsMentions(items: KnowledgeItem[], query: string): MentionOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listDocsMentions(items);
  return items
    .filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    )
    .map((item) => ({
      id: `docs:${item.id}`,
      kind: "docs",
      value: item.id,
      label: item.title,
      description: item.description || item.content.slice(0, 80).trim(),
      icon: "BookOpen",
    }));
}

/** Resolve a docs mention value to its knowledge item for context building. */
export function resolveDocsMention(value: string, items: KnowledgeItem[]): KnowledgeItem | undefined {
  return items.find((item) => item.id === value);
}
