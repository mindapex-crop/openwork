/** @jsxImportSource react */
import type { OpenWorkExtensionContribution } from "@/app/extensions";
import { VoiceInputRender } from "./composer-voice-input";

/**
 * Built-in composer-action declarations, expressed as OpenWork
 * `composer-action` contribution manifests. The L2 loader
 * (`../extensions/register-composer-actions.ts`) walks this array at
 * startup and registers each entry into the L1 composer contribution
 * registry — the core composer never imports any of these modules directly.
 *
 * Add a new row here to introduce a built-in composer action (voice,
 * screenshot, web search, etc.). Third-party plugins that need a
 * composer button call `registerComposerAction(...)` directly — the L1
 * registry accepts both paths.
 */
export const BUILT_IN_COMPOSER_ACTIONS: Array<{
  extensionId: string;
  contribution: OpenWorkExtensionContribution & {
    type: "composer-action";
    composerAction: NonNullable<OpenWorkExtensionContribution["composerAction"]>;
  };
}> = [
  {
    extensionId: "openwork-voice-input",
    contribution: {
      type: "composer-action",
      location: "composer",
      composerAction: {
        id: "mic",
        slot: "leading",
        priority: 10,
        render: VoiceInputRender,
      },
    },
  },
];
