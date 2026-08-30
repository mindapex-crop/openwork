/** @jsxImportSource react */
import { useCallback, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { SKILL_CATALOG } from "../skills/skill-catalog";
import { EXPERT_CATEGORIES } from "./expert-taxonomy";
import type { Expert, ExpertInput } from "./types";

export type ExpertFormLabels = {
  titleCreate: string;
  titleEdit: string;
  subtitle: string;
  name: string;
  namePlaceholder: string;
  nameRequired: string;
  description: string;
  descriptionPlaceholder: string;
  category: string;
  systemPrompt: string;
  systemPromptPlaceholder: string;
  systemPromptRequired: string;
  methodology: string;
  methodologyPlaceholder: string;
  skills: string;
  skillsHint: string;
  model: string;
  modelPlaceholder: string;
  save: string;
  saving: string;
  cancel: string;
  close: string;
  back: string;
  saveFailed: string;
};

export type ExpertFormProps = {
  /** 传入既有专家为编辑，null/undefined 为新建。 */
  initial?: Expert | null;
  labels: ExpertFormLabels;
  onSubmit: (input: ExpertInput) => Promise<void>;
  onCancel: () => void;
  /** 内联模式下显示在标题左侧的返回按钮。 */
  onBack?: () => void;
};

function toFormValue(expert: Expert | null | undefined): Omit<ExpertInput, "avatar"> {
  return {
    name: expert?.name ?? "",
    description: expert?.description ?? "",
    systemPrompt: expert?.systemPrompt ?? "",
    methodology: expert?.methodology ?? "",
    skills: expert?.skills ?? [],
    model: expert?.model ?? "",
    category: expert?.category ?? "",
  };
}

function FormBody(props: {
  labels: ExpertFormLabels;
  value: Omit<ExpertInput, "avatar">;
  onChange: (next: Omit<ExpertInput, "avatar">) => void;
  error: string | null;
}) {
  const { labels, value, onChange, error } = props;
  const toggleSkill = useCallback(
    (skillId: string) => {
      onChange({
        ...value,
        skills: value.skills.includes(skillId)
          ? value.skills.filter((id) => id !== skillId)
          : [...value.skills, skillId],
      });
    },
    [value, onChange],
  );

  return (
    <div className="space-y-4 py-2">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="expert-name">{labels.name} *</Label>
        <Input
          id="expert-name"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder={labels.namePlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expert-description">{labels.description}</Label>
        <Input
          id="expert-description"
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          placeholder={labels.descriptionPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expert-category">{labels.category}</Label>
        <select
          id="expert-category"
          value={value.category ?? ""}
          onChange={(event) => onChange({ ...value, category: event.target.value })}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
        >
          <option value="">{EXPERT_CATEGORIES[EXPERT_CATEGORIES.length - 1]}</option>
          {EXPERT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expert-prompt">{labels.systemPrompt} *</Label>
        <Textarea
          id="expert-prompt"
          value={value.systemPrompt}
          onChange={(event) => onChange({ ...value, systemPrompt: event.target.value })}
          placeholder={labels.systemPromptPlaceholder}
          className="min-h-[140px] font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expert-methodology">{labels.methodology}</Label>
        <Textarea
          id="expert-methodology"
          value={value.methodology}
          onChange={(event) => onChange({ ...value, methodology: event.target.value })}
          placeholder={labels.methodologyPlaceholder}
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label>{labels.skills}</Label>
        <p className="text-xs text-muted-foreground">{labels.skillsHint}</p>
        <ScrollArea className="max-h-40 rounded-xl border border-border">
          <ScrollAreaViewport className="flex flex-wrap gap-1.5 p-2">
            {SKILL_CATALOG.map((skill) => {
              const active = value.skills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:border-muted-foreground",
                  )}
                >
                  {active ? <Check className="size-3" /> : null}
                  <span className="font-mono">{skill.name}</span>
                </button>
              );
            })}
          </ScrollAreaViewport>
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expert-model">{labels.model}</Label>
        <Input
          id="expert-model"
          value={value.model ?? ""}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
          placeholder={labels.modelPlaceholder}
        />
      </div>
    </div>
  );
}

/**
 * 专家编辑表单主体：校验 + 提交，供内联编辑视图与 Dialog 两种形态复用。
 */
export function ExpertForm(props: ExpertFormProps) {
  const { labels, initial, onCancel, onBack } = props;
  const [value, setValue] = useState<Omit<ExpertInput, "avatar">>(() => toFormValue(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!value.name.trim()) {
        setError(labels.nameRequired);
        return;
      }
      if (!value.systemPrompt.trim()) {
        setError(labels.systemPromptRequired);
        return;
      }
      setSubmitting(true);
      try {
        await props.onSubmit({
          name: value.name.trim(),
          description: value.description.trim(),
          systemPrompt: value.systemPrompt,
          methodology: value.methodology.trim(),
          skills: value.skills,
          model: value.model?.trim() || undefined,
          category: value.category?.trim() || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.saveFailed);
      } finally {
        setSubmitting(false);
      }
    },
    [value, labels, props],
  );

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              title={labels.back}
              aria-label={labels.back}
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <h2 className="text-sm font-semibold">
            {initial ? labels.titleEdit : labels.titleCreate}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} title={labels.close} aria-label={labels.close}>
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-4 p-4">
            <FormBody labels={labels} value={value} onChange={setValue} error={error} />
          </div>
        </ScrollAreaViewport>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 size-3.5" />
          )}
          {submitting ? labels.saving : labels.save}
        </Button>
      </div>
    </form>
  );
}

export type ExpertFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入既有专家为编辑，null/undefined 为新建。 */
  initial?: Expert | null;
  labels: ExpertFormLabels;
  onSubmit: (input: ExpertInput) => Promise<void>;
};

/** Dialog 形态的专家编辑表单（供 MarketPlace 等宿主以弹窗内联创建/编辑专家）。 */
export function ExpertFormDialog(props: ExpertFormDialogProps) {
  const { labels, initial, open, onOpenChange } = props;
  const [value, setValue] = useState<Omit<ExpertInput, "avatar">>(() => toFormValue(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!value.name.trim()) {
      setError(labels.nameRequired);
      return;
    }
    if (!value.systemPrompt.trim()) {
      setError(labels.systemPromptRequired);
      return;
    }
    setSubmitting(true);
    try {
      await props.onSubmit({
        name: value.name.trim(),
        description: value.description.trim(),
        systemPrompt: value.systemPrompt,
        methodology: value.methodology.trim(),
        skills: value.skills,
        model: value.model?.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }, [value, labels, props]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? labels.titleEdit : labels.titleCreate}</DialogTitle>
          <DialogDescription>{labels.subtitle}</DialogDescription>
        </DialogHeader>
        <FormBody labels={labels} value={value} onChange={setValue} error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Check className="mr-1 size-3.5" />}
            {submitting ? labels.saving : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
