/** @jsxImportSource react */
import { useCallback, useSyncExternalStore } from "react";
import { Copy, ExternalLink, Package } from "lucide-react";

import { openDesktopPath } from "@/app/lib/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ArtifactIcon } from "./artifact-icon";
import {
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPE_ORDER,
  type DeliveryGroup,
  type DeliveryItem,
  type DeliverySummaryStore,
  type DeliveryType,
  deliveryItemsStore,
} from "./delivery-summary-store";
import type { OpenTargetPreview } from "./open-target";

const DELIVERY_TO_PREVIEW_MAP: Readonly<Record<DeliveryType, OpenTargetPreview>> = {
  markdown: "markdown",
  docx: "document",
  xlsx: "sheet",
  pptx: "slides",
  pdf: "pdf",
  image: "image",
  code: "text",
};

const EMPTY_ITEMS: DeliveryItem[] = [];

export interface DeliverySummaryPanelProps {
  items?: DeliveryItem[];
  store?: DeliverySummaryStore;
  title?: string;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function DeliverySummaryPanel({ items, store, title = "Delivery Summary" }: DeliverySummaryPanelProps) {
  const activeStore = store ?? deliveryItemsStore;
  const controlledItems = items ?? EMPTY_ITEMS;
  const storeItems = useSyncExternalStore(activeStore.subscribe, activeStore.getSnapshot);

  const total = items ? controlledItems.length : storeItems.length;

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Copied path to clipboard.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not copy path.");
    }
  }, []);

  const openItem = useCallback(async (item: DeliveryItem) => {
    try {
      await openDesktopPath(item.sourcePath);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : `Could not open ${item.name}.`);
    }
  }, []);

  const itemsByType = items
    ? groupItemsByType(controlledItems)
    : activeStore.groupByType();

  const counts = new Map<DeliveryType, number>();
  for (const group of itemsByType) {
    counts.set(group.type, group.items.length);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-background mac:bg-background/80 mac:backdrop-blur-2xl mac:backdrop-saturate-150">
        <div className="flex h-auto flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {total === 0 ? "No deliverables yet" : `${total} deliverable${total === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          {itemsByType.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {itemsByType.map((group) => (
                <Badge key={group.type} variant="secondary" className="gap-1">
                  <span>{DELIVERY_TYPE_LABELS[group.type]}</span>
                  <span className="text-muted-foreground">{group.items.length}</span>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="size-full">
          <div className="flex flex-col gap-4 p-4">
            {itemsByType.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                <Package className="size-6" />
                <p className="text-sm">Files produced in this session will appear here.</p>
              </div>
            ) : (
              itemsByType.map((group) => (
                <Card key={group.type} variant="outline" size="sm" className="gap-2">
                  <div className="flex items-center gap-2 px-3 pt-2.5">
                    <ArtifactIcon type={DELIVERY_TO_PREVIEW_MAP[group.type]} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {DELIVERY_TYPE_LABELS[group.type]}
                    </span>
                    <span className="text-xs text-muted-foreground/60">{group.items.length}</span>
                  </div>
                  <ul className="flex flex-col">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40"
                      >
                        <ArtifactIcon type={DELIVERY_TO_PREVIEW_MAP[item.type]} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.sourcePath}</p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatSize(item.size)}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger
                              render={(
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => void openItem(item)}
                                  aria-label={`Open ${item.name}`}
                                >
                                  <ExternalLink />
                                </Button>
                              )}
                            />
                            <TooltipContent>Open file</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={(
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => void copyPath(item.sourcePath)}
                                  aria-label={`Copy path of ${item.name}`}
                                >
                                  <Copy />
                                </Button>
                              )}
                            />
                            <TooltipContent>Copy path</TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function groupItemsByType(items: DeliveryItem[]): DeliveryGroup[] {
  const groups: DeliveryGroup[] = [];
  const byType = new Map<DeliveryType, DeliveryItem[]>();
  for (const item of items) {
    const existing = byType.get(item.type);
    if (existing) existing.push(item);
    else byType.set(item.type, [item]);
  }
  for (const type of DELIVERY_TYPE_ORDER) {
    const matching = byType.get(type);
    if (matching && matching.length > 0) groups.push({ type, items: matching });
  }
  return groups;
}