/** @jsxImportSource react */
import type { OpenWorkExtensionContribution } from "@/app/extensions";
import { VoiceInputRender } from "./composer-voice-input";

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
