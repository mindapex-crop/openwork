/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, Plus, RefreshCw, Search, Sparkles, TerminalSquare, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { installSkillTemplate, listLocalSkills, uninstallSkill } from "@/app/lib/desktop";
import { isDesktopRuntime } from "@/app/lib/runtime-env";
import { cn } from "@/lib/utils";
import { mergedInstalledNames, useSkillInstallStore } from "./skill-install-store";

import {
  SKILL_CATALOG,
  SKILL_CATEGORIES,
  buildSkillMarkdown,
  categoryCount,
  filterSkills,
  skillCommandSlug,
  type SkillCategory,
  type SkillEntry,
} from "./skill-catalog";

export type SkillMarketplacePageProps = {
  /** 由宿主（设置/侧栏）在需要时传入，用于关闭当前页面。 */
  onClose?: () => void;
  /** 桌面端：安装技能的目标工作区目录；缺省或非桌面端不展示安装能力。 */
  workspaceRoot?: string;
};

const ALL_CATEGORY = "全部" as const;
type ActiveCategory = SkillCategory | typeof ALL_CATEGORY;

const categoryLabel = (category: ActiveCategory) => category;
const categoryValue = (category: ActiveCategory) => category;

/** 精选技能（WorkBuddy 风格） */
const FEATURED_SKILLS = [
  {
    id: "writing-article",
    title: "公众号长文写作",
    description: "从选题大纲到成稿，一站式产出",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop",
    skillName: "write-article",
  },
  {
    id: "data-analysis",
    title: "数据分析与可视化",
    description: "分析表格数据，提取指标与趋势",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop",
    skillName: "analyze-data",
  },
  {
    id: "code-review",
    title: "代码审查",
    description: "以评审视角检查改动，定位问题",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop",
    skillName: "review-code",
  },
  {
    id: "content-repurposer",
    title: "内容多平台改写",
    description: "一鱼多吃，跨平台适配",
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
    skillName: "repurpose-content",
  },
  {
    id: "bug-diagnosis",
    title: "Bug 诊断",
    description: "按流程围堵疑难 Bug",
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=300&fit=crop",
    skillName: "diagnose-bug",
  },
];

function SkillUsage({ entry }: { entry: SkillEntry }) {
  const command = skillCommandSlug(entry);
  const toolHint = entry.suggestedTool ? `配合 ${entry.suggestedTool} 使用效果最佳。` : "";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
        <TerminalSquare className="size-3.5" />
        使用方式
      </span>
      <span className="font-mono text-[11px] text-primary">{command}</span>
      <span className="leading-relaxed">
        在会话中直接输入该斜杠命令即可调用；若尚未安装，可先将其安装到
        <code className="mx-1 rounded bg-background px-1 py-0.5 font-mono text-[10px]">.claude/skills</code>
        目录后再试。{toolHint}
      </span>
    </div>
  );
}

export function SkillMarketplacePage(props: SkillMarketplacePageProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActiveCategory>(ALL_CATEGORY);
  const [sourceTab, setSourceTab] = useState<"发现" | "已安装" | "已导入">("发现");
  const [featuredSeed, setFeaturedSeed] = useState(0);
  // 已安装技能名集合（桌面端 listLocalSkills，仅用于状态展示与卸载入口）。
  const [installedNames, setInstalledNames] = useState<ReadonlySet<string>>(new Set());
  // 本地已导入（磁盘上存在但不在精选目录里）的技能名。
  const [importedNames, setImportedNames] = useState<ReadonlySet<string>>(new Set());
  const [busyName, setBusyName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const installedMap = useSkillInstallStore((s) => s.installed);
  const inUseList = useSkillInstallStore((s) => s.inUse);

  const canInstall = isDesktopRuntime() && Boolean(props.workspaceRoot?.trim());
  const markInstalled = useSkillInstallStore((s) => s.markInstalled);
  const markUninstalled = useSkillInstallStore((s) => s.markUninstalled);

  const shuffledFeatured = useMemo(() => {
    const copy = [...FEATURED_SKILLS];
    let s = featuredSeed;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [featuredSeed]);

  const shuffleFeatured = useCallback(() => {
    setFeaturedSeed((prev) => prev + 1);
  }, []);

  const catalogNames = useMemo(() => new Set(SKILL_CATALOG.map((s) => s.name)), []);

  const refreshInstalled = useCallback(async () => {
    const root = props.workspaceRoot?.trim();
    if (!isDesktopRuntime() || !root) {
      setInstalledNames(new Set());
      setImportedNames(new Set());
      return;
    }
    try {
      const cards = await listLocalSkills(root);
      const names = cards.map((card) => card.name);
      setInstalledNames(new Set(names));
      setImportedNames(new Set(names.filter((name) => !catalogNames.has(name))));
    } catch {
      setInstalledNames(new Set());
      setImportedNames(new Set());
    }
  }, [props.workspaceRoot, catalogNames]);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  const handleInstall = useCallback(async (entry: SkillEntry) => {
    if (busyName) return;
    const root = props.workspaceRoot?.trim();
    setBusyName(entry.name);
    setActionError(null);
    try {
      // Real on-disk install only when a desktop workspace is available; the
      // persisted mirror records 已安装 for every runtime.
      if (root && isDesktopRuntime()) {
        const result = (await installSkillTemplate(root, entry.name, buildSkillMarkdown(entry), {
          overwrite: false,
        })) as { ok: boolean; stdout: string; stderr: string };
        if (!result.ok && !/already exists/i.test(result.stderr)) {
          setActionError(result.stderr || result.stdout || "安装失败，请重试。");
        }
      }
      markInstalled(entry.name);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "安装失败，请重试。");
    } finally {
      setBusyName(null);
      await refreshInstalled();
    }
  }, [busyName, props.workspaceRoot, refreshInstalled, markInstalled]);

  const handleUninstall = useCallback(async (entry: SkillEntry) => {
    if (busyName) return;
    const root = props.workspaceRoot?.trim();
    setBusyName(entry.name);
    setActionError(null);
    try {
      if (root && isDesktopRuntime()) {
        await uninstallSkill(root, entry.name);
      }
      markUninstalled(entry.name);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "卸载失败，请重试。");
    } finally {
      setBusyName(null);
      await refreshInstalled();
    }
  }, [busyName, props.workspaceRoot, refreshInstalled, markUninstalled]);

  const categoriesWithItems = useMemo(
    () => SKILL_CATEGORIES.filter((c) => categoryCount(SKILL_CATALOG, c) > 0),
    [],
  );
  const hasCategoryItems = categoriesWithItems.length > 0;

  const installedSet = useMemo(() => mergedInstalledNames(installedNames), [installedNames, installedMap]);  const inUseSet = useMemo(() => new Set(inUseList), [inUseList]);
  const installedCount = installedSet.size;

  const filtered = useMemo(() => {
    const base = filterSkills(SKILL_CATALOG, { query, category });
    if (sourceTab === "已安装") return base.filter((entry) => installedSet.has(entry.name));
    return base;
  }, [query, category, sourceTab, installedSet]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="font-heading text-lg font-medium">技能与 Agent 广场</h1>
          {props.onClose ? (
            <button
              type="button"
              onClick={props.onClose}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              关闭
            </button>
          ) : null}
        </div>
        <p className="text-sm text-dls-secondary">
          精选开箱即用的本地技能，按需搜索、筛选，并在会话中用斜杠命令调用。
        </p>
      </div>

      {/* 精选技能 hero */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground/80">精选技能</h2>
          <button
            type="button"
            onClick={shuffleFeatured}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="size-3" />
            换一换
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {shuffledFeatured.map((skill) => (
            <div
              key={skill.id}
              className="group relative w-56 shrink-0 cursor-pointer overflow-hidden rounded-xl"
            >
              <img
                src={skill.image}
                alt={skill.title}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-sm font-semibold text-white">{skill.title}</p>
                <p className="mt-0.5 text-xs text-white/70 line-clamp-1">{skill.description}</p>
              </div>
            </div>
          ))}
        </div>
        {/* 来源子标签 */}
        <div className="flex gap-1">
          {([
            { id: "发现", count: null },
            { id: "已安装", count: installedCount },
            { id: "已导入", count: importedNames.size },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                sourceTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {tab.id}
              {tab.count !== null && tab.count > 0 ? (
                <span className="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums dark:bg-white/10">{tab.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索技能，如：写作、数据分析、review…"
            className="pl-9"
            aria-label="搜索技能"
          />
        </div>

        {hasCategoryItems ? (
          <Tabs
            value={categoryValue(category)}
            onValueChange={(value) => {
              if (value === ALL_CATEGORY || (SKILL_CATEGORIES as readonly string[]).includes(value)) {
                setCategory(value as ActiveCategory);
              }
            }}
          >
            <TabsList variant="line" className="flex-wrap justify-start gap-1">
              <TabsTrigger value={categoryValue(ALL_CATEGORY)}>
                {categoryLabel(ALL_CATEGORY)}
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {SKILL_CATALOG.length}
                </span>
              </TabsTrigger>
              {categoriesWithItems.map((c) => (
                <TabsTrigger key={c} value={categoryValue(c)}>
                  {categoryLabel(c)}
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                    {categoryCount(SKILL_CATALOG, c)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          {actionError}
        </div>
      ) : null}

      {sourceTab === "已导入" ? (
        importedNames.size === 0 ? (
          <div className="rounded-4xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            暂无已导入的本地技能。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...importedNames].map((name) => (
              <Card key={name} variant="default" size="sm" className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <CardTitle className="truncate font-mono text-sm">{name}</CardTitle>
                  <Badge variant="outline" className="w-fit">本地已导入</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {sourceTab === "已安装" ? "还没有安装任何技能。" : "没有匹配的技能，换个关键词或分类试试。"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <SkillCard
              key={entry.id}
              entry={entry}
              canInstall
              installed={installedSet.has(entry.name)}
              inUse={inUseSet.has(entry.name)}
              busy={busyName === entry.name}
              onInstall={() => void handleInstall(entry)}
              onUninstall={() => void handleUninstall(entry)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SkillCard({
  entry,
  canInstall,
  installed,
  inUse,
  busy,
  onInstall,
  onUninstall,
}: {
  entry: SkillEntry;
  canInstall: boolean;
  installed: boolean;
  inUse: boolean;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <Card variant="default" size="sm" className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate font-mono text-sm">{entry.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {entry.category}
          </Badge>
        </div>
        <CardDescription className="leading-relaxed">{entry.description}</CardDescription>
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className={cn("capitalize")}>
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-auto pt-1">
          <SkillUsage entry={entry} />
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-2">
          {installed ? (
            <>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" />
                已安装
              </span>
              {inUse ? (
                <Badge variant="default" className="h-5 px-1.5 text-[10px]">使用中</Badge>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto gap-1"
                disabled={busy}
                onClick={onUninstall}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onInstall}
              className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              aria-label="安装"
              title="安装"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              安装
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}