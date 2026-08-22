import { useState } from "react";
import { FileText, ScrollText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { KnowledgeSourceType } from "./knowledge-types";

type KnowledgeCreateDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  onCreate: (title: string, description: string, content: string, sourceType: KnowledgeSourceType) => void;
};

const SOURCE_TYPES: { value: KnowledgeSourceType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "text", label: "Text", icon: ScrollText },
  { value: "file", label: "File", icon: FileText },
];

export function KnowledgeCreateDialog(props: KnowledgeCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("text");

  const handleCreate = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }
    props.onCreate(trimmedTitle, description.trim(), content.trim(), sourceType);
    setTitle("");
    setDescription("");
    setContent("");
    setSourceType("text");
  };

  const Icon = SOURCE_TYPES.find((t) => t.value === sourceType)?.icon ?? ScrollText;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange?.(open);
        if (!open) {
          setTitle("");
          setDescription("");
          setContent("");
          setSourceType("text");
        }
      }}
    >
      {props.trigger ? (
        <DialogTrigger>{props.trigger}</DialogTrigger>
      ) : props.children ? (
        <DialogTrigger>{props.children}</DialogTrigger>
      ) : null}
      <DialogContent className="gap-0 max-h-[70vh] overflow-hidden p-0 rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">New Knowledge</DialogTitle>
              <DialogDescription className="mt-1">
                Create a new knowledge item.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => props.onOpenChange?.(false)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <Card variant="outline" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon size={14} />
                Source type
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((type) => {
                  const active = sourceType === type.value;
                  const TypeIcon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSourceType(type.value)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                        (active
                          ? "border-ring bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted")
                      }
                    >
                      <TypeIcon size={12} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            <label htmlFor="knowledge-title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Knowledge title"
              className="h-9 rounded-lg"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="knowledge-description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Textarea
              id="knowledge-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Brief description (optional)"
              className="min-h-[60px] rounded-lg"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="knowledge-content" className="text-xs font-medium text-muted-foreground">
              Content
            </label>
            <Textarea
              id="knowledge-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Paste or type your knowledge content here..."
              className="min-h-[120px] rounded-lg font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={title.trim().length === 0}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
