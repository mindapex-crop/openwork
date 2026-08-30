/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { ArrowUp, Building2, Folder, Plug, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { currentLocale } from "../../../i18n";
import { MarbleAvatar } from "@/react-app/design-system/marble-avatar";
import { cn } from "@/lib/utils";
import { SKILL_CATALOG } from "../skills/skill-catalog";
import {
  composeExpertPrompt,
  expertStartSuggestions,
  normalizeExpertCategory,
} from "./expert-taxonomy";
import type { Expert } from "./types";

const DETAIL_DICT = {
  zh: {
    goodAt: "擅长任务",
    style: "工作风格",
    startTask: "开始任务",
    placeholder: "请输入内容，专家将按自身方法与建议开始任务",
    send: "发送",
    general: "通用",
    workspace: "工作目录",
    model: "模型",
    connector: "连接器",
    defaultWorkspace: "默认工作区",
  },
  en: {
    goodAt: "Good at",
    style: "Working style",
    startTask: "Start a task",
    placeholder: "Type a task — the expert will run it with its own method",
    send: "Send",
    general: "General",
    workspace: "Directory",
    model: "Model",
    connector: "Connectors",
    defaultWorkspace: "Default workspace",
  },
} as const;

function skillLabel(idOrName: string): string {
  const skill = SKILL_CATALOG.find((entry) => entry.id === idOrName || entry.name === idOrName);
  return skill ? skill.name : idOrName;
}

function methodologyBullets(methodology: string): string[] {
  return methodology
    .split(/\r?\n|；|;/)
    .map((line) => line.replace(/^[\s\-•\d.]+/, "").trim())
    .filter(Boolean);
}

export type ExpertDetailDialogProps = {
  expert: Expert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceRoot?: string;
  /** Launches a real OpenCode session seeded with the composed expert prompt. */
  onStartTask?: (prompt: string) => void;
};

export function ExpertDetailDialog(props: ExpertDetailDialogProps) {
  const dict = currentLocale() === "zh" ? DETAIL_DICT.zh : DETAIL_DICT.en;
  const { expert } = props;
  const [text, setText] = useState("");
  const suggestions = expert ? expertStartSuggestions(expert) : [];

  useEffect(() => {
    if (props.open) setText("");
  }, [props.open, expert?.id]);

  if (!expert) return null;

  const goodAt = expert.skills.length > 0
    ? expert.skills.map(skillLabel)
    : methodologyBullets(expert.methodology).slice(0, 4);
  const styleBullets = methodologyBullets(expert.methodology);

  const runTask = (prompt: string) => {
    const composed = composeExpertPrompt(expert, prompt);
    props.onOpenChange(false);
    props.onStartTask?.(composed);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="flex items-start gap-3">
          <MarbleAvatar seed={expert.name || expert.id} className="size-12 shrink-0" square />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="truncate text-base font-semibold">{expert.name}</DialogTitle>
              <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                <Building2 className="size-3" />
                {normalizeExpertCategory(expert.category)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{expert.description || "—"}</p>
          </div>
        </div>

        {goodAt.length > 0 ? (
          <div className="mt-4">
            <h4 className="mb-1.5 text-sm font-medium">{dict.goodAt}</h4>
            <div className="flex flex-wrap gap-1.5">
              {goodAt.map((item, index) => (
                <Badge key={`${item}-${index}`} variant="outline" className="text-[11px]">{item}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        {styleBullets.length > 0 ? (
          <div className="mt-3">
            <h4 className="mb-1.5 text-sm font-medium">{dict.style}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {styleBullets.map((line, index) => (
                <li key={index} className="flex gap-2"><span>•</span><span>{line}</span></li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4">
          <h4 className="mb-1.5 text-sm font-medium">{dict.startTask}</h4>
          <div className="space-y-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => runTask(suggestion)}
                className="block w-full truncate rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Composer footer (WorkBuddy 专家详情底部) */}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={dict.placeholder}
            rows={2}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
          />
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">{dict.general}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
              <Folder className="size-3" />
              {props.workspaceRoot ? props.workspaceRoot.split("/").pop() || dict.defaultWorkspace : dict.defaultWorkspace}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
              <Plug className="size-3" />
              {dict.connector}
            </span>
            {expert.model ? (
              <span className="truncate">{dict.model}: {expert.model}</span>
            ) : null}
            <Button
              size="sm"
              className={cn("ml-auto h-7 gap-1")}
              disabled={text.trim().length === 0 || !props.onStartTask}
              onClick={() => runTask(text)}
            >
              <ArrowUp className="size-3.5" />
              {dict.send}
            </Button>
          </div>
        </div>

        <p className="sr-only">
          <Zap className="inline size-3" /> {expert.name}
        </p>
      </DialogContent>
    </Dialog>
  );
}
