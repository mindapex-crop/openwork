/** @jsxImportSource react */
import type { QuickCommandMode } from "./composer-quick-commands";
import { QUICK_COMMAND_DEFINITIONS, useQuickCommandsStore } from "./composer-quick-commands";

type QuickActionButtonProps = {
  mode: QuickCommandMode;
};

export function QuickActionButton({ mode }: QuickActionButtonProps) {
  const isActive = useQuickCommandsStore((state) => state.isActive(mode));
  const toggle = useQuickCommandsStore((state) => state.toggle);

  const definition = QUICK_COMMAND_DEFINITIONS.find((d) => d.id === mode);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const IconComp = definition?.icon as React.ComponentType<{ className?: string; size?: number }> | null;

  return (
    <button
      type="button"
      onClick={() => toggle(mode)}
      aria-label={definition?.labelKey ?? mode}
      title={definition ? `${definition.labelKey}${isActive ? " \u2713" : ""}` : mode}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
        isActive
          ? "bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
          : "text-gray-10 hover:bg-gray-3"
      }`}
    >
      {IconComp ? <IconComp size={14} /> : null}
    </button>
  );
}
