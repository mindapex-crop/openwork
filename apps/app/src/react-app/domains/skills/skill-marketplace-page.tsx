/** @jsxImportSource react */
import { useMemo, useState } from "react";
import { Search, Sparkles, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  SKILL_CATALOG,
  SKILL_CATEGORIES,
  categoryCount,
  filterSkills,
  skillCommandSlug,
  type SkillCategory,
  type SkillEntry,
} from "./skill-catalog";

export type SkillMarketplacePageProps = {
  /** 由宿主（设置/侧栏）在需要时传入，用于关闭当前页面。 */
  onClose?: () => void;
};

const ALL_CATEGORY = "全部" as const;
type ActiveCategory = SkillCategory | typeof ALL_CATEGORY;

const categoryLabel = (category: ActiveCategory) => category;
const categoryValue = (category: ActiveCategory) => category;

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

  const categoriesWithItems = useMemo(
    () => SKILL_CATEGORIES.filter((c) => categoryCount(SKILL_CATALOG, c) > 0),
    [],
  );
  const hasCategoryItems = categoriesWithItems.length > 0;

  const filtered = useMemo(
    () => filterSkills(SKILL_CATALOG, { query, category }),
    [query, category],
  );

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

      {filtered.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          没有匹配的技能，换个关键词或分类试试。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <SkillCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}

function SkillCard({ entry }: { entry: SkillEntry }) {
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
      </CardContent>
    </Card>
  );
}