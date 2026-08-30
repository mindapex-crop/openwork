/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { ArrowRight, Megaphone, X, Zap } from "lucide-react";

import { DEFAULT_MODEL } from "@/app/constants";
import type { ComposerAttachment } from "@/app/types";
import { resolveOrganizationPromptCardContent } from "@/components/chat/task-suggestions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCheckDesktopRestriction, useOrgRestrictions } from "@/react-app/domains/cloud/desktop-config-provider";
import { useDenAuth } from "@/react-app/domains/cloud/den-auth-provider";
import {
  getOpenWorkModelsActionUrl,
  hideOpenWorkModelsPromo,
  isOpenWorkModelsPromoHidden,
  openWorkModelsPromoChangedEvent,
  useOpenWorkModelsPromoEligibility,
} from "@/react-app/domains/cloud/openwork-models-promo";
import { usePlatform } from "@/react-app/kernel/platform";
import { t } from "@/i18n";
import { NewTaskComposer, type NewTaskComposerContext, type TaskMode } from "./new-task-composer";
import { TASK_MODE_OPTIONS } from "./task-mode";

type HeroSuggestion = {
  title: string;
  description: string;
  prompt: string;
};

const DEFAULT_SUGGESTIONS: HeroSuggestion[] = [
  {
    title: "Summarize my week",
    description: "Pull highlights from email and calendar.",
    prompt: "Summarize my week: pull the highlights from my connected email and calendar and give me a short digest of what happened and what needs my attention.",
  },
  {
    title: "Clean up a spreadsheet",
    description: "Drop in a CSV and describe the result you want.",
    prompt: "Create a sample CSV file with 20 rows of fake customer data (name, email, company, revenue). Then show me a summary of the data.",
  },
  {
    title: "Draft a document",
    description: "Reports, emails, or briefs from a few bullet points.",
    prompt: "Draft a one-page project brief. Ask me for the bullet points you need, then turn them into a clear, well-structured document.",
  },
  {
    title: "Automate a web task",
    description: "Use the built-in browser for repetitive steps.",
    prompt: "Open craigslist.org in the browser and search for couches for sale. Show me the top 5 results with prices.",
  },
];

export type SessionEmptyHeroProps = {
  providerCount: number;
  /** Disable submission while a default workspace is being prepared. */
  busy?: boolean;
  /** Called with the task prompt and attachments; the caller creates the session (and workspace if needed). */
  onRunTask: (prompt: string, attachments: ComposerAttachment[]) => void;
  /**
   * Plan-mode hook: called with the raw prompt when the user submits while
   * taskMode is "plan". Wires the hero into the planning lifecycle.
   */
  onStartPlan?: (prompt: string) => void;
  onOpenProviderAuth?: () => void;
  /** Workspace-scoped wiring for the full composer (skills, agents, models). */
  composer?: NewTaskComposerContext | null;
};

/**
 * Paper "first chat" empty state: the real session composer front and
 * center with suggestion cards below. Suggestions come from desktop
 * policies (organization onboarding prompts) when configured, with
 * built-in defaults otherwise.
 */
export function SessionEmptyHero(props: SessionEmptyHeroProps) {
  const [prompt, setPrompt] = useState("");
  const orgRestrictions = useOrgRestrictions();
  const checkDesktopRestriction = useCheckDesktopRestriction();
  const canAddProviders = !checkDesktopRestriction({ restriction: "allowCustomProviders" });
  const platform = usePlatform();
  const denAuth = useDenAuth();
  const openWorkModelsPromoEligible = useOpenWorkModelsPromoEligibility();
  const [modelsPromoHidden, setModelsPromoHidden] = useState(isOpenWorkModelsPromoHidden);

  useEffect(() => {
    const handlePromoChanged = () => setModelsPromoHidden(isOpenWorkModelsPromoHidden());
    window.addEventListener(openWorkModelsPromoChangedEvent, handlePromoChanged);
    return () => window.removeEventListener(openWorkModelsPromoChangedEvent, handlePromoChanged);
  }, []);

  // Pull task-mode state from the composer wiring if present; otherwise keep
  // a local fallback so the hero still looks correct before the workspace
  // client finishes initialising.
  const taskModeFromContext = props.composer?.taskMode ?? "ask";
  const canChangeMode = Boolean(props.composer?.onTaskModeChange);
  const taskModes = TASK_MODE_OPTIONS;

  // Quiet inline lead to OpenWork Models: replaces the old startup dialog
  // interrupt. Shown only while the session runs on the free starter model
  // (the built-in `opencode` provider) and the hosted offering applies.
  const onFreeStarterModel = props.composer?.selectedModel.providerID === DEFAULT_MODEL.providerID;
  const showModelsHint =
    openWorkModelsPromoEligible &&
    !modelsPromoHidden &&
    !props.composer?.openWorkModelsEntitled &&
    onFreeStarterModel;

  const organizationPrompts = orgRestrictions.onboardingPrompts;
  const suggestions: HeroSuggestion[] = organizationPrompts !== undefined
    ? organizationPrompts.map((orgPrompt, index) => {
      const card = resolveOrganizationPromptCardContent({
        prompt: orgPrompt,
        description: orgRestrictions.onboardingPromptDescriptions?.[index],
        index,
      });
      return { title: card.title, description: card.description, prompt: card.selectionPrompt };
    })
    : DEFAULT_SUGGESTIONS;

  const submit = (resolvedPrompt: string, attachments: ComposerAttachment[]) => {
    const trimmedPrompt = resolvedPrompt.trim();
    if (!trimmedPrompt || props.busy) return;
    props.onRunTask(trimmedPrompt, attachments);
  };

  const fillPrompt = (value: string) => {
    setPrompt(value);
    window.dispatchEvent(new Event("openwork:focusPrompt"));
  };

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-6 px-4 max-lg:px-4 sm:px-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-foreground">
          OpenWork, 我帮你
        </h2>
        <p className="text-[13px] text-muted-foreground">用自然语言描述你的需求，我来帮你完成</p>
      </div>

      <div className="flex justify-center">
        <Tabs
          value={taskModeFromContext}
          onValueChange={(next) => {
            if (!canChangeMode) return;
            const mode = (next as TaskMode) ?? "ask";
            props.composer?.onTaskModeChange?.(mode);
          }}
        >
          <TabsList
            className="h-10 gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur"
          >
            {taskModes.map((mode) => {
              const ModeIcon = mode.icon;
              return (
                <TabsTrigger
                  key={mode.value}
                  value={mode.value}
                  className="h-9 min-w-[108px] rounded-[10px] px-3.5 text-[13px] font-medium tracking-[-0.01em] text-muted-foreground/80 transition-all data-active:bg-background data-active:text-foreground data-active:shadow-[0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(255,255,255,0.04)]"
                  title={mode.description}
                >
                  <ModeIcon className="mr-1.5 size-4" />
                  {mode.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <NewTaskComposer
        draft={prompt}
        onDraftChange={setPrompt}
        onRunTask={submit}
        onStartPlan={props.onStartPlan}
        busy={props.busy ?? false}
        context={props.composer ?? null}
      />

      {showModelsHint ? (
        <div
          className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground"
          data-testid="openwork-models-hint"
        >
          <span>Using the free starter model.</span>
          <button
            type="button"
            className="flex items-center gap-1 font-medium text-blue-10 transition-colors hover:text-blue-11"
            onClick={() => platform.openLink(getOpenWorkModelsActionUrl(denAuth.isSignedIn, "sign-up"))}
          >
            Get frontier models with no API keys
            <ArrowRight className="size-3" />
          </button>
          <button
            type="button"
            className="flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground"
            onClick={hideOpenWorkModelsPromo}
            aria-label="Hide OpenWork Models hint"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}

      {!showModelsHint && canAddProviders && props.providerCount === 0 && props.onOpenProviderAuth ? (
        <button
          type="button"
          className="flex w-full items-start gap-3 rounded-xl border border-blue-7/50 bg-blue-2/40 p-3.5 text-left transition-colors hover:bg-blue-3/50"
          onClick={props.onOpenProviderAuth}
        >
          <Zap className="mt-0.5 size-4 shrink-0 text-blue-10" />
          <div>
            <div className="text-[13px] font-medium text-foreground">Connect a model provider</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Add an API key for Anthropic, OpenAI, Google, or other providers so tasks can run.
            </div>
          </div>
        </button>
      ) : null}

      {/* WorkBuddy 风格分类标签 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { label: "文档处理", prompt: "帮我处理一份文档：" },
          { label: "金融服务", prompt: "帮我分析一个金融投资问题：" },
          { label: "数据分析及可视化", prompt: "帮我分析以下数据并生成可视化报告：" },
          { label: "个人工作台", prompt: "帮我整理个人工作台：" },
          { label: "幻灯片", prompt: "帮我创建一份幻灯片：" },
        ].map((cat) => (
          <button
            key={cat.label}
            type="button"
            className="rounded-full border border-border bg-background px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            onClick={() => fillPrompt(cat.prompt)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 快捷操作 chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { icon: "📝", label: "写文章", prompt: "帮我写一篇文章，主题是：" },
          { icon: "📊", label: "分析数据", prompt: "帮我分析以下数据并生成报告：" },
          { icon: "🔍", label: "审查代码", prompt: "请审查我的代码改动并给出建议：" },
          { icon: "🌐", label: "浏览器任务", prompt: "帮我在浏览器中完成以下操作：" },
          { icon: "📋", label: "整理文档", prompt: "帮我整理和总结以下文档内容：" },
          { icon: "⚡", label: "自动化", prompt: "帮我创建一个自动化任务：" },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => fillPrompt(chip.prompt)}
          >
            <span>{chip.icon}</span>
            {chip.label}
          </button>
        ))}
      </div>

      {/* WorkBuddy 风格活动推广横幅 */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Megaphone className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">OpenWork 新功能上线</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            探索专家协作、自动化工作流和技能广场，提升你的工作效率
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            className="rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:bg-accent"
            onClick={() => fillPrompt(suggestion.prompt)}
          >
            <div className="truncate text-[13px] font-medium text-foreground">{suggestion.title}</div>
            <div className="mt-0.5 line-clamp-2 text-[12px] leading-[17px] text-muted-foreground">
              {suggestion.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
