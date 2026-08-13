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
  draft: string;
  setDraft: (value: string) => void;
  busy: boolean;
  disabled: boolean;
};

export type ComposerActionContribution = {
  id: string;
  slot: ComposerActionSlot;
  /** Higher values render first within the slot. Defaults to 0. */
  priority?: number;
  render: (ctx: ComposerContributionContext) => ReactNode;
};

const registry = new Map<string, ComposerActionContribution>();

export function registerComposerAction(contribution: ComposerActionContribution) {
  registry.set(contribution.id, contribution);
}

export function unregisterComposerAction(id: string) {
  registry.delete(id);
}

export function getComposerActions(slot: ComposerActionSlot): ComposerActionContribution[] {
  return [...registry.values()]
    .filter((action) => action.slot === slot)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
