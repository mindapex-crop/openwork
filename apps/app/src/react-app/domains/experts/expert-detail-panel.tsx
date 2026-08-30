/** @jsxImportSource react */
import { ArrowLeft, BookOpenText, Cpu, ListChecks, Pencil, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { MarbleAvatar } from "@/react-app/design-system/marble-avatar";

import type { Expert } from "./types";

export type ExpertDetailLabels = {
  title: string;
  methodology: string;
  systemPrompt: string;
  skills: string;
  model: string;
  noSkills: string;
  back: string;
  edit: string;
  delete: string;
  close: string;
};

export type ExpertDetailPanelProps = {
  expert: Expert;
  labels: ExpertDetailLabels;
  onBack?: () => void;
  onClose?: () => void;
  onEdit?: (expert: Expert) => void;
  onDelete?: (expert: Expert) => void;
};

export function ExpertDetailPanel(props: ExpertDetailPanelProps) {
  const { expert, labels } = props;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {props.onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onBack}
              title={labels.back}
              aria-label={labels.back}
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <div className="flex items-center gap-2">
            {expert.avatar ? (
              <img src={expert.avatar} alt="" loading="lazy" className="size-5 rounded object-cover" />
            ) : (
              <MarbleAvatar seed={expert.name || expert.id} className="size-5" square />
            )}
            <h2 className="text-sm font-semibold">{labels.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {props.onEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => props.onEdit?.(expert)}
              title={labels.edit}
              aria-label={labels.edit}
            >
              <Pencil size={14} />
            </Button>
          ) : null}
          {props.onDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive"
              onClick={() => props.onDelete?.(expert)}
              title={labels.delete}
              aria-label={labels.delete}
            >
              <Trash2 size={14} />
            </Button>
          ) : null}
          {props.onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onClose}
              title={labels.close}
              aria-label={labels.close}
            >
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-4 p-4">
            <Card size="sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{expert.name}</CardTitle>
                  {expert.model ? (
                    <Badge variant="secondary" className="shrink-0">
                      <Cpu size={12} className="mr-1" />
                      {expert.model}
                    </Badge>
                  ) : null}
                </div>
                <CardDescription className="leading-relaxed">
                  {expert.description || "—"}
                </CardDescription>
              </CardHeader>
            </Card>

            {expert.methodology ? (
              <Card variant="outline" size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <ListChecks size={14} />
                    {labels.methodology}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{expert.methodology}</p>
                </CardContent>
              </Card>
            ) : null}

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <BookOpenText size={14} />
                  {labels.systemPrompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {expert.systemPrompt || <span className="text-muted-foreground">—</span>}
                </div>
              </CardContent>
            </Card>

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{labels.skills}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {expert.skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{labels.noSkills}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {expert.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}
