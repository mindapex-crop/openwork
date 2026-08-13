import { BUILT_IN_OPENWORK_EXTENSION_MANIFESTS } from "@/app/extensions";
import { registerComposerAction, type ComposerActionContribution as ActionShape } from "@/react-app/domains/session/surface/composer/composer-contributions";
import { BUILT_IN_COMPOSER_ACTIONS } from "@/react-app/domains/session/surface/composer/built-in-composer-actions";

/**
 * L2 loader seam: turn every manifest-declared `composer-action` (both the
 * built-in array above and any future runtime extensions) into a live
 * `registerComposerAction(...)` call at startup. The core composer never
 * imports any specific feature module; it only reads the L1 registry.
 */

export function registerComposerContributions(): void {
  for (const { extensionId, contribution } of BUILT_IN_COMPOSER_ACTIONS) {
    registerComposerActionFromManifest(extensionId, contribution.composerAction, contribution.composerAction.render);
  }
}

export function registerComposerActionFromManifest(
  extensionId: string,
  action: ActionShape,
  render: ActionShape["render"],
): void {
  registerComposerAction({
    id: `${extensionId}:${action.id}`,
    slot: action.slot,
    priority: action.priority,
    render,
  });
}
