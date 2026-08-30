/** @jsxImportSource react */
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Flame, Lightbulb, Plus, RefreshCw, Sparkles, Wrench, X } from "lucide-react";

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
import { currentLocale } from "../../../i18n";
import { cn } from "@/lib/utils";

import { INSPIRATION_PACKS, createExpertFromPack } from "./inspiration-store";
import type { InspirationPack } from "./types";

/**
 * 页面级双语字典（全局 i18n 由他人负责，这里仅定义本页文案，不触碰 locales）。
 * key 使用 inspiration.* 前缀。
 */
const INSPIRATION_DICT = {
  zh: {
    "inspiration.list.title": "灵感",
    "inspiration.list.subtitle": "精选的 Prompt + 技能组合包，一键应用到会话或创建专家。",
    "inspiration.list.empty": "暂无灵感组合包。",
    "inspiration.category.workflow": "工作流",
    "inspiration.category.expert": "专家",
    "inspiration.detail.title": "组合包详情",
    "inspiration.detail.back": "返回列表",
    "inspiration.detail.close": "关闭",
    "inspiration.detail.prompt": "Prompt",
    "inspiration.detail.skills": "绑定技能",
    "inspiration.detail.tags": "标签",
    "inspiration.actions.applyToSession": "应用到新会话",
    "inspiration.actions.createExpert": "一键创建专家",
    "inspiration.feedback.promptCopied": "Prompt 已复制，可粘贴到新会话使用。",
    "inspiration.feedback.expertCreated": "专家「{name}」已创建。",
    "inspiration.feedback.expertCreateFailed": "创建专家失败：{error}",
    "inspiration.feedback.applyFailed": "当前宿主未提供会话入口，已复制 Prompt。",
    "inspiration.status.creating": "正在创建专家…",
  },
  en: {
    "inspiration.list.title": "Inspiration",
    "inspiration.list.subtitle": "Curated Prompt + Skill packs. Apply to a session or create an expert in one click.",
    "inspiration.list.empty": "No inspiration packs yet.",
    "inspiration.category.workflow": "Workflow",
    "inspiration.category.expert": "Expert",
    "inspiration.detail.title": "Pack Detail",
    "inspiration.detail.back": "Back to list",
    "inspiration.detail.close": "Close",
    "inspiration.detail.prompt": "Prompt",
    "inspiration.detail.skills": "Bound Skills",
    "inspiration.detail.tags": "Tags",
    "inspiration.actions.applyToSession": "Apply to new session",
    "inspiration.actions.createExpert": "Create expert",
    "inspiration.feedback.promptCopied": "Prompt copied. Paste it into a new session.",
    "inspiration.feedback.expertCreated": "Expert “{name}” created.",
    "inspiration.feedback.expertCreateFailed": "Failed to create expert: {error}",
    "inspiration.feedback.applyFailed": "No session entry provided by host; Prompt copied instead.",
    "inspiration.status.creating": "Creating expert…",
  },
} as const;

type InspirationDictKey = keyof (typeof INSPIRATION_DICT)["zh"];

type InspirationDict = Record<InspirationDictKey, string>;

const pickDict = (): InspirationDict => (currentLocale() === "zh" ? INSPIRATION_DICT.zh : INSPIRATION_DICT.en);

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

export type InspirationPageProps = {
  onClose?: () => void;
  /** 宿主提供的新会话入口：传入后"应用到新会话"直接调用；缺省则复制 Prompt。 */
  onApplyToSession?: (prompt: string) => void;
};

type Feedback =
  | { kind: "info"; message: string }
  | { kind: "error"; message: string }
  | null;

const CATEGORY_FILTERS = [
  { id: "all", label: "全部", labelEn: "All" },
  { id: "workflow", label: "工作流", labelEn: "Workflow" },
  { id: "expert", label: "专家", labelEn: "Expert" },
  { id: "writing", label: "写作", labelEn: "Writing" },
  { id: "code", label: "编程", labelEn: "Code" },
  { id: "data", label: "数据", labelEn: "Data" },
  { id: "meeting", label: "会议", labelEn: "Meeting" },
  { id: "report", label: "报告", labelEn: "Report" },
  { id: "marketing", label: "营销", labelEn: "Marketing" },
  { id: "design", label: "设计", labelEn: "Design" },
  { id: "education", label: "教育", labelEn: "Education" },
  { id: "finance", label: "金融", labelEn: "Finance" },
  { id: "hr", label: "人事", labelEn: "HR" },
  { id: "legal", label: "法务", labelEn: "Legal" },
  { id: "ops", label: "运营", labelEn: "Ops" },
] as const;

export function InspirationPage(props: InspirationPageProps) {
  const dict = pickDict();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [shuffleKey, setShuffleKey] = useState(0);

  const isZh = currentLocale() === "zh";

  const filteredPacks = useMemo(() => {
    if (activeCategory === "all") return INSPIRATION_PACKS;
    if (activeCategory === "workflow" || activeCategory === "expert") {
      return INSPIRATION_PACKS.filter((p) => p.category === activeCategory);
    }
    return INSPIRATION_PACKS.filter((p) =>
      p.tags.some((tag) => {
        const lower = tag.toLowerCase();
        const cat = activeCategory.toLowerCase();
        return lower.includes(cat) || cat.includes(lower);
      }) || p.skills.some((s) => s.toLowerCase().includes(activeCategory.toLowerCase())),
    );
  }, [activeCategory]);

  const selected = useMemo(
    () => INSPIRATION_PACKS.find((pack) => pack.id === selectedId) ?? null,
    [selectedId],
  );

  const applyToSession = async (pack: InspirationPack) => {
    if (props.onApplyToSession) {
      props.onApplyToSession(pack.prompt);
      return;
    }
    try {
      await navigator.clipboard?.writeText(pack.prompt);
      setFeedback({ kind: "info", message: dict["inspiration.feedback.promptCopied"] });
    } catch {
      setFeedback({ kind: "error", message: dict["inspiration.feedback.applyFailed"] });
    }
  };

  const createExpert = async (pack: InspirationPack) => {
    setCreating(true);
    setFeedback(null);
    try {
      const result = await createExpertFromPack(pack);
      if (result.ok) {
        setFeedback({
          kind: "info",
          message: format(dict["inspiration.feedback.expertCreated"], { name: pack.title }),
        });
      } else {
        setFeedback({
          kind: "error",
          message: format(dict["inspiration.feedback.expertCreateFailed"], { error: result.error }),
        });
      }
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    return (
      <PackDetail
        pack={selected}
        dict={dict}
        creating={creating}
        feedback={feedback}
        onBack={() => {
          setSelectedId(null);
          setFeedback(null);
        }}
        onClose={props.onClose}
        onApplyToSession={() => void applyToSession(selected)}
        onCreateExpert={() => void createExpert(selected)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={dict["inspiration.detail.close"]} aria-label={dict["inspiration.detail.close"]}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-4 px-4 pb-6">
            {/* WorkBuddy 风格 Hero 区域 */}
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-amber-1/5 via-transparent to-primary/3 px-5 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-3/10 dark:bg-amber-3/15">
                <Lightbulb className="size-5 text-amber-11 dark:text-amber-9" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold text-foreground">{dict["inspiration.list.title"]}</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {dict["inspiration.list.subtitle"]}
                </p>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="text-center">
                  <div className="text-[18px] font-semibold text-foreground">{INSPIRATION_PACKS.length}</div>
                  <div className="text-[10px] text-muted-foreground">{isZh ? "精选组合" : "Packs"}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveCategory("all");
                    setShuffleKey((k) => k + 1);
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  {isZh ? "换一批" : "Shuffle"}
                </Button>
              </div>
            </div>

            {/* WorkBuddy 风格分类标签 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] transition-colors",
                    activeCategory === cat.id
                      ? "border-primary/40 bg-primary/10 text-primary font-medium"
                      : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:bg-accent hover:text-foreground",
                  )}
                >
                  {isZh ? cat.label : cat.labelEn}
                </button>
              ))}
            </div>

            {/* 热门推荐标签 */}
            <div className="flex items-center gap-2">
              <Flame className="size-3.5 text-orange-10" />
              <span className="text-[12px] font-medium text-foreground">{isZh ? "热门推荐" : "Trending"}</span>
            </div>

            {filteredPacks.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {dict["inspiration.list.empty"]}
              </div>
            ) : (
              <div key={shuffleKey} className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
                {filteredPacks.map((pack) => (
                  <PackCard key={pack.id} pack={pack} dict={dict} onOpen={() => setSelectedId(pack.id)} />
                ))}
              </div>
            )}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}

function categoryLabel(dict: InspirationDict, category: InspirationPack["category"]): string {
  return category === "workflow"
    ? dict["inspiration.category.workflow"]
    : dict["inspiration.category.expert"];
}

const PACK_EMOJI: Record<string, string> = {
  "weekly-report": "📝",
  "code-review-expert": "🔍",
  "product-requirement-breakdown": "📋",
  "meeting-notes": "🗒️",
  "data-analysis-report": "📊",
  "content-polish": "✨",
};

function PackCard({
  pack,
  dict,
  onOpen,
}: {
  pack: InspirationPack;
  dict: InspirationDict;
  onOpen: () => void;
}) {
  const emoji = PACK_EMOJI[pack.id] ?? "💡";
  return (
    <button type="button" onClick={onOpen} className="group text-left">
      <Card
        className={cn(
          "h-full transition-all hover:ring-2 hover:ring-primary/30 hover:shadow-sm",
          "ring-1 ring-white/5 dark:ring-white/10",
        )}
        size="sm"
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[18px]">
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="line-clamp-1 text-sm">{pack.title}</CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {categoryLabel(dict, pack.category)}
                </Badge>
              </div>
              <CardDescription className="mt-1 line-clamp-2 leading-relaxed">
                {pack.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {pack.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="font-mono text-[10px]">
                {skill}
              </Badge>
            ))}
            {pack.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function PackDetail({
  pack,
  dict,
  creating,
  feedback,
  onBack,
  onClose,
  onApplyToSession,
  onCreateExpert,
}: {
  pack: InspirationPack;
  dict: InspirationDict;
  creating: boolean;
  feedback: Feedback;
  onBack: () => void;
  onClose?: () => void;
  onApplyToSession: () => void;
  onCreateExpert: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={onBack} title={dict["inspiration.detail.back"]} aria-label={dict["inspiration.detail.back"]}>
            <ArrowLeft size={14} />
          </Button>
          <h2 className="text-sm font-semibold">{dict["inspiration.detail.title"]}</h2>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon-sm" onClick={onClose} title={dict["inspiration.detail.close"]} aria-label={dict["inspiration.detail.close"]}>
            <X size={14} />
          </Button>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-4 p-4">
            {feedback ? (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  feedback.kind === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400",
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            <Card size="sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{pack.title}</CardTitle>
                    <CardDescription className="mt-1 leading-relaxed">{pack.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {categoryLabel(dict, pack.category)}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Wrench size={14} />
                  {dict["inspiration.detail.skills"]}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {pack.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="font-mono text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card variant="outline" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Sparkles size={14} />
                  {dict["inspiration.detail.prompt"]}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {pack.prompt}
                </div>
              </CardContent>
            </Card>

            {pack.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {pack.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" size="sm" onClick={onApplyToSession}>
          <Copy size={14} className="mr-1" />
          {dict["inspiration.actions.applyToSession"]}
        </Button>
        <Button size="sm" onClick={onCreateExpert} disabled={creating}>
          {creating ? <Sparkles size={14} className="mr-1 animate-pulse" /> : <Plus size={14} className="mr-1" />}
          {creating ? dict["inspiration.status.creating"] : dict["inspiration.actions.createExpert"]}
        </Button>
      </div>
    </div>
  );
}
