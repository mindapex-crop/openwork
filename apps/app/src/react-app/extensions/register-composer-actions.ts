import { registerComposerAction, type ComposerActionContribution as ActionShape } from "@/react-app/domains/session/surface/composer/composer-contributions";
import { BUILT_IN_COMPOSER_ACTIONS } from "@/react-app/domains/session/surface/composer/built-in-composer-actions";

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
