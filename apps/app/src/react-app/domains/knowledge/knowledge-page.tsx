import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  FileText,
  Plus,
  Search,
  ScrollText,
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
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { KnowledgeCreateDialog } from "./knowledge-create-dialog";
import { KnowledgeDetailPanel } from "./knowledge-detail-panel";
import { useKnowledgeStore } from "./knowledge-store";
import type { KnowledgeItem, KnowledgeSourceType } from "./knowledge-types";

type KnowledgePageProps = {
  onClose?: () => void;
};

function sourceTypeIcon(sourceType: KnowledgeItem["sourceType"]) {
  return sourceType === "file" ? FileText : ScrollText;
}

function sourceTypeLabel(sourceType: KnowledgeItem["sourceType"]) {
  return sourceType === "file" ? t("library.source_file") : t("library.source_text");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KnowledgePage(props: KnowledgePageProps) {
  const items = useKnowledgeStore((state) => state.items);
  const createKnowledge = useKnowledgeStore((state) => state.createKnowledge);
  const deleteKnowledge = useKnowledgeStore((state) => state.deleteKnowledge);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.content.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  if (selected) {
    return (
      <KnowledgeDetailPanel
        item={selected}
        onClose={props.onClose}
        onBack={() => setSelectedId(null)}
        onDelete={(id) => {
          deleteKnowledge(id);
          setSelectedId(null);
          if (props.onClose) {
            props.onClose();
          }
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold">{t("library.tab_knowledge")}</h2>
        </div>
        <div className="flex items-center gap-1">
          {props.onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onClose}
              title={t("common.close")}
              aria-label={t("common.close")}
            >
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("library.search_placeholder")}
            className="h-8 pl-9 rounded-lg"
          />
        </div>
        <KnowledgeCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={(title, description, content, sourceType) => {
            createKnowledge(title, description, content, sourceType);
            setCreateOpen(false);
          }}
        >
          <Button size="sm" variant="default">
            <Plus size={14} />
            {t("library.new_knowledge")}
          </Button>
        </KnowledgeCreateDialog>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          {filteredItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {query
                ? t("library.no_search_results")
                : t("library.no_items")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
              {filteredItems.map((item) => {
                const SourceIcon = sourceTypeIcon(item.sourceType);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="group text-left"
                  >
                    <Card
                      className={cn(
                        "h-full transition-colors hover:ring-primary/30",
                        "ring-1 ring-white/5 dark:ring-white/10",
                      )}
                      size="sm"
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <SourceIcon size={14} className="text-muted-foreground" />
                            <CardTitle className="line-clamp-1 text-sm">
                              {item.title}
                            </CardTitle>
                          </div>
                          <Badge variant="secondary">
                            {sourceTypeLabel(item.sourceType)}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {item.description || t("library.no_description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock size={12} />
                          <span className="line-clamp-1">
                            {formatDate(item.updatedAt)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}
