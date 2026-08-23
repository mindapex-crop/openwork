/** @jsxImportSource react */
import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { subscribeLocale, currentLocale, t } from "@/i18n";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type ModulePlaceholderPageProps = {
  /** i18n key suffix for the module, e.g. "experts" → sidebar.experts / placeholder.experts.* */
  module: "experts" | "projects" | "inspiration";
  icon: LucideIcon;
};

export function ModulePlaceholderPage(props: ModulePlaceholderPageProps) {
  // Re-render on language switch so placeholder copy follows the app locale immediately.
  React.useSyncExternalStore(subscribeLocale, currentLocale);
  const Icon = props.icon;
  return (
    <div
      data-module-placeholder={props.module}
      className="flex min-h-full items-center justify-center p-8"
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{t(`sidebar.${props.module}`)}</EmptyTitle>
          <EmptyDescription className="max-w-md">
            {t(`placeholder.${props.module}.description`)}
          </EmptyDescription>
        </EmptyHeader>
        <p data-module-placeholder-coming-soon className="text-muted-foreground text-sm">
          {t("placeholder.coming_soon")}
        </p>
      </Empty>
    </div>
  );
}
