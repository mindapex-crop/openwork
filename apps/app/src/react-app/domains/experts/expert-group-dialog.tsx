/** @jsxImportSource react */
import { useCallback, useState, type FormEvent } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useExpertsStore } from "./experts-store";
import type { ExpertGroup, ExpertGroupInput, ExpertGroupStrategy } from "./expert-group-types";

export type ExpertGroupDialogLabels = {
  titleCreate: string;
  titleEdit: string;
  subtitle: string;
  name: string;
  namePlaceholder: string;
  nameRequired: string;
  description: string;
  descriptionPlaceholder: string;
  leader: string;
  leaderPlaceholder: string;
  leaderRequired: string;
  members: string;
  membersPlaceholder: string;
  strategy: string;
  addMember: string;
  removeMember: string;
  save: string;
  saving: string;
  cancel: string;
  saveFailed: string;
};

export type ExpertGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入既有专家组为编辑，null/undefined 为新建。 */
  initial?: ExpertGroup | null;
  labels: ExpertGroupDialogLabels;
  onSubmit: (input: ExpertGroupInput) => Promise<void>;
};

const STRATEGY_OPTIONS: { value: ExpertGroupStrategy; label_zh: string; label_en: string }[] = [
  { value: "conservative", label_zh: "保守", label_en: "Conservative" },
  { value: "balanced", label_zh: "平衡", label_en: "Balanced" },
  { value: "aggressive", label_zh: "激进", label_en: "Aggressive" },
];

function toFormValue(group: ExpertGroup | null | undefined): ExpertGroupInput {
  return {
    name: group?.name ?? "",
    description: group?.description ?? "",
    leaderId: group?.leaderId ?? "",
    memberIds: group?.memberIds ?? [],
    strategy: group?.strategy ?? "balanced",
  };
}

export function ExpertGroupDialog(props: ExpertGroupDialogProps) {
  const { labels, initial, open, onOpenChange } = props;
  const experts = useExpertsStore((state) => state.experts);

  const [value, setValue] = useState<ExpertGroupInput>(() => toFormValue(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReset = useCallback(() => {
    setValue(toFormValue(initial));
    setError(null);
  }, [initial]);

  // 当 open 状态变更时重置表单
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) handleReset();
      onOpenChange(next);
    },
    [handleReset, onOpenChange],
  );

  const addMember = useCallback(() => {
    setValue((prev) => ({ ...prev, memberIds: [...prev.memberIds, ""] }));
  }, []);

  const removeMember = useCallback((index: number) => {
    setValue((prev) => ({
      ...prev,
      memberIds: prev.memberIds.filter((_, i) => i !== index),
    }));
  }, []);

  const updateMember = useCallback((index: number, expertId: string) => {
    setValue((prev) => ({
      ...prev,
      memberIds: prev.memberIds.map((id, i) => (i === index ? expertId : id)),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      setError(null);

      if (!value.name.trim()) {
        setError(labels.nameRequired);
        return;
      }
      if (!value.leaderId) {
        setError(labels.leaderRequired);
        return;
      }

      const validMembers = value.memberIds.filter((id) => id && id !== value.leaderId);

      setSubmitting(true);
      try {
        await props.onSubmit({
          name: value.name.trim(),
          description: value.description.trim(),
          leaderId: value.leaderId,
          memberIds: validMembers,
          strategy: value.strategy,
        });
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.saveFailed);
      } finally {
        setSubmitting(false);
      }
    },
    [value, labels, props, onOpenChange],
  );

  // 可选专家（排除已被选为组长的）
  const availableForLeader = experts;
  const availableForMember = experts.filter((e) => e.id !== value.leaderId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? labels.titleEdit : labels.titleCreate}</DialogTitle>
          <DialogDescription>{labels.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="contents">
          <ScrollArea className="max-h-[60vh]">
            <ScrollAreaViewport>
              <div className="space-y-4 py-2 pr-2">
                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="group-name">{labels.name} *</Label>
                  <Input
                    id="group-name"
                    value={value.name}
                    onChange={(event) => setValue((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={labels.namePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-description">{labels.description}</Label>
                  <Textarea
                    id="group-description"
                    value={value.description}
                    onChange={(event) =>
                      setValue((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder={labels.descriptionPlaceholder}
                    className="min-h-[60px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{labels.leader} *</Label>
                  {availableForLeader.length > 0 ? (
                    <Select
                      value={value.leaderId}
                      onValueChange={(v: string | null) =>
                        setValue((prev) => ({ ...prev, leaderId: v ?? "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={labels.leaderPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableForLeader.map((expert) => (
                          <SelectItem key={expert.id} value={expert.id}>
                            {expert.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={value.leaderId}
                      onChange={(event) =>
                        setValue((prev) => ({ ...prev, leaderId: event.target.value }))
                      }
                      placeholder={labels.leaderPlaceholder}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{labels.members}</Label>
                  {value.memberIds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{labels.membersPlaceholder}</p>
                  ) : (
                    <div className="space-y-2">
                      {value.memberIds.map((memberId, index) => (
                        <div key={index} className="flex items-center gap-2">
                          {availableForMember.length > 0 ? (
                            <Select
                              value={memberId}
                              onValueChange={(v: string | null) => updateMember(index, v ?? "")}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder={labels.membersPlaceholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableForMember.map((expert) => (
                                  <SelectItem key={expert.id} value={expert.id}>
                                    {expert.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={memberId}
                              onChange={(event) => updateMember(index, event.target.value)}
                              placeholder={labels.membersPlaceholder}
                              className="flex-1"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(index)}
                            aria-label={labels.removeMember}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMember}
                    className="gap-1"
                  >
                    <Plus size={14} />
                    {labels.addMember}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>{labels.strategy}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {STRATEGY_OPTIONS.map((opt) => {
                      const active = value.strategy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setValue((prev) => ({ ...prev, strategy: opt.value }))
                          }
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input hover:border-muted-foreground",
                          )}
                        >
                          {opt.label_zh} / {opt.label_en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollAreaViewport>
          </ScrollArea>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 size-3.5" />
            )}
            {submitting ? labels.saving : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
