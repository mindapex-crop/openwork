/** @jsxImportSource react */
import {
  Database,
  FileText,
  GitPullRequest,
  GraduationCap,
  Heart,
  Newspaper,
  type LucideIcon,
} from "lucide-react"
import type { AutomationTemplate } from "./automation-templates"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { formatAutomationSchedule } from "./automation-format"
import { t } from "@/i18n"

const ICON_MAP: Record<string, LucideIcon> = {
  Newspaper,
  FileText,
  GitPullRequest,
  Heart,
  GraduationCap,
  Database,
}

function TemplateIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] ?? Database
  return <Icon className="size-5" />
}

export type AutomationTemplateCardProps = {
  template: AutomationTemplate
  onUse: (template: AutomationTemplate) => void
}

export function AutomationTemplateCard({ template, onUse }: AutomationTemplateCardProps) {
  return (
    <Card variant="outline" className="h-full transition-colors hover:bg-muted/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TemplateIcon name={template.icon} />
          </span>
          <Badge variant="secondary">{template.category}</Badge>
        </div>
        <CardTitle className="mt-2">{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardFooter className="flex-col items-stretch gap-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">{template.instructions}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{formatAutomationSchedule(template.schedule)}</span>
          <button
            type="button"
            className="h-7 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            onClick={() => onUse(template)}
          >
            {t("automations.use_template")}
          </button>
        </div>
      </CardFooter>
    </Card>
  )
}
