/** @jsxImportSource react */
import { Briefcase, Code2, Palette } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import type { WorkMode } from "./work-mode";

const OPTIONS: Array<{
  mode: WorkMode;
  icon: typeof Briefcase;
  labelKey: string;
  descKey: string;
}> = [
  { mode: "daily", icon: Briefcase, labelKey: "work_mode.daily", descKey: "work_mode.daily_desc" },
  { mode: "code", icon: Code2, labelKey: "work_mode.code", descKey: "work_mode.code_desc" },
  { mode: "design", icon: Palette, labelKey: "work_mode.design", descKey: "work_mode.design_desc" },
];

type WorkModeStepProps = {
  onSelect: (mode: WorkMode) => void;
  /** 紧凑布局（设置页内嵌），默认纵向列表。 */
  compact?: boolean;
};

export function WorkModeStep({ onSelect, compact = false }: WorkModeStepProps) {
  return (
    <div className={cn("grid gap-3", compact ? "sm:grid-cols-3" : "grid-cols-1")}>
      {OPTIONS.map(({ mode, icon: Icon, labelKey, descKey }) => (
        <button key={mode} type="button" className="group text-left" onClick={() => onSelect(mode)}>
          <Card
            className="h-full transition-colors group-hover:ring-primary/40"
            size="sm"
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">{t(labelKey)}</CardTitle>
              </div>
              <CardDescription className="text-xs leading-5">{t(descKey)}</CardDescription>
            </CardHeader>
          </Card>
        </button>
      ))}
    </div>
  );
}
