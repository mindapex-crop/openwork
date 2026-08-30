import type { ComposerMentionKind } from "./mention-encoding";

/** Extended mention kinds beyond the core agent/file/app for the enhanced @ mention system. */
export type ExtendedMentionKind = Exclude<ComposerMentionKind, "agent" | "file" | "app">;

/** A single option surfaced in the composer @ mention menu. */
export interface MentionOption {
  id: string;
  kind: ComposerMentionKind;
  value: string;
  label: string;
  description?: string;
  /** Lucide icon name used in the mention menu. */
  icon?: string;
}

/** A group of mention options shown under a shared heading in the menu. */
export interface MentionGroup {
  /** i18n key for the group heading. */
  labelKey: string;
  kind: ComposerMentionKind;
  items: MentionOption[];
}

/** Categories shown in the mention menu, in display order. */
export const MENTION_GROUPS: readonly ComposerMentionKind[] = [
  "file",
  "code",
  "docs",
  "git",
  "terminal",
  "rules",
  "app",
];
