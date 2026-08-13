import type { ReactNode } from "react";

/**
 * Composer contribution points.
 *
 * Incremental features (voice input, screenshots, web search, ...) mount into
 * the composer action row without touching the core composer by registering a
 * contribution here. The core composer only renders whatever is registered for
 * each slot — it knows nothing about individual features.
 *
 * This is the extension seam for the composer: built-in incremental features
 * live in their own modules (e.g. composer-voice-input.tsx) and register
 * themselves at module load; third-party plugins can call
 * `registerComposerAction` the same way.
 */

/** Where in the action row a contribution mounts. */
export type ComposerActionSlot = "leading" | "trailing";

/** Context passed to every contribution render. */
export type ComposerContributionContext = {
  /** Current draft text. */
  draft: string;
  /** Replace the whole draft content. */
  setDraft: (value: string) => void;
  /** True while the agent is busy (mid-task). */
  busy: boolean;
  /** True when the composer is disabled. */
  disabled: boolean;
};

export type ComposerActionContribution = {
  /** Unique id, e.g. "voice-input". */
  id: string;
  /** Which part of the action row this mounts into. */
  slot: ComposerActionSlot;
  /** Higher values render first within the slot. Defaults to 0. */
  priority?: number;
  render: (ctx: ComposerContributionContext) => ReactNode;
};

const registry = new Map<string, ComposerActionContribution>();

/** Register a contribution. Registering an existing id replaces it. */
export function registerComposerAction(contribution: ComposerActionContribution) {
  registry.set(contribution.id, contribution);
}

/** Remove a previously registered contribution. */
export function unregisterComposerAction(id: string) {
  registry.delete(id);
}

/** All contributions for a slot, ordered by priority (desc) then registration order. */
export function getComposerActions(slot: ComposerActionSlot): ComposerActionContribution[] {
  return [...registry.values()]
    .filter((action) => action.slot === slot)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
