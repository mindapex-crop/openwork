import {
  ArrowLeft,
  CalendarClock,
  FileText,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";

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

import type { KnowledgeItem } from "./knowledge-types";

type KnowledgeDetailPanelProps = {
  item: KnowledgeItem;
  onClose?: () => void;
  onBack?: () => void;
  onDelete?: (id: string) => void;
};

function sourceTypeIcon(sourceType: KnowledgeItem["sourceType"]) {
  return sourceType === "file" ? FileText : ScrollText;
}

function sourceTypeLabel(sourceType: KnowledgeItem["sourceType"]) {
  return sourceType === "file" ? "File" : "Text";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KnowledgeDetailPanel(props: KnowledgeDetailPanelProps) {
  const SourceIcon = sourceTypeIcon(props.item.sourceType);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {props.onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onBack}
              title="Back to list"
              aria-label="Back to list"
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <div className="flex items-center gap-2">
            <SourceIcon size={16} className="text-foreground" />
            <h2 className="text-sm font-semibold">Knowledge Detail</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {props.onDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => props.onDelete?.(props.item.id)}
              title="Delete"
              aria-label="Delete knowledge"
            >
              <Trash2 size={14} />
            </Button>
          ) : null}
          {props.onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onClose}
              title="Close"
              aria-label="Close"
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
                  <CardTitle className="text-base">{props.item.title}</CardTitle>
                  <Badge variant="secondary">
                    <SourceIcon size={12} className="mr-1" />
                    {sourceTypeLabel(props.item.sourceType)}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-3">
                  {props.item.description || "No description."}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Content</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {props.item.content || <span className="text-muted-foreground">No content.</span>}
                </div>
              </CardContent>
            </Card>

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock size={12} />
                  <span>Created: {formatDate(props.item.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock size={12} />
                  <span>Updated: {formatDate(props.item.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}
