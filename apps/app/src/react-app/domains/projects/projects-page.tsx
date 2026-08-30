/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, Cloud, FolderKanban, HardDrive, LayoutTemplate, MessagesSquare, Plus, Search, Sparkles, Users, Wrench, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { useExpertsStore } from "@/react-app/domains/experts/experts-store";
import { SKILL_CATALOG } from "@/react-app/domains/skills/skill-catalog";
import { IM_CONNECTOR_DEFINITIONS, useImConnectorStore } from "@/react-app/domains/settings/im-connector-store";
import { cn } from "@/lib/utils";

import { CollabHubPage } from "../collab";
import { ProjectDetailPanel } from "./project-detail-panel";
import { useProjectStore, useProjects } from "./project-store";
import type { Project, ProjectStatus } from "./project-store";
import type { SessionSurfaceProps } from "../session/surface/session-surface";
import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import { filterProjectsByScope, projectCardDateLabel } from "./project-display";
import type { ProjectListScope } from "./project-display";
import { TemplateWizard } from "../codegen/template-wizard";

type ProjectsPageProps = {
  onClose?: () => void;
  workspaceType?: "local" | "remote";
  serverConnected?: boolean;
  workspaceId?: string | null;
  workspaceRoot?: string;
  canCreateTask?: boolean;
  client?: OpenworkServerClient | null;
  getThreadSurface?: (threadId: string) => SessionSurfaceProps | null;
  createThread?: () => Promise<string | null>;
};

const EMPTY = "";

const statusVariant: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  done: "outline",
};

const statusLabel: Record<ProjectStatus, string> = {
  active: "projects.status_active",
  paused: "projects.status_paused",
  done: "projects.status_done",
};

const PROJECT_TEMPLATES = [
  { id: "software", name: "软件开发", description: "需求分析、架构设计、编码与测试", icon: "💻" },
  { id: "marketing", name: "营销推广", description: "市场调研、内容策划、渠道投放", icon: "📣" },
  { id: "research", name: "研究报告", description: "文献综述、数据收集、报告撰写", icon: "🔬" },
  { id: "operations", name: "运营管理", description: "流程优化、指标监控、团队协作", icon: "⚙️" },
];

function countTasks(project: Project): number {
  return project.plans.reduce((total, plan) => total + plan.tasks.length, 0);
}

function countDoneTasks(project: Project): number {
  return project.plans.reduce(
    (total, plan) => total + plan.tasks.filter((task) => task.status === "done").length,
    0,
  );
}

function progress(project: Project): number {
  const total = countTasks(project);
  if (total === 0) {
    return 0;
  }
  return Math.round((countDoneTasks(project) / total) * 100);
}

function recentActivityLabel(project: Project): string {
  const latest = project.plans
    .flatMap((plan) => plan.tasks)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!latest) {
    return t("projects.no_activity");
  }
  return t("projects.last_activity", { title: latest.title });
}

export function ProjectsPage(props: ProjectsPageProps) {
  const projects = useProjects();
  const createProject = useProjectStore((state) => state.createProject);
  const experts = useExpertsStore((state) => state.experts);
  const fetchExperts = useExpertsStore((state) => state.fetchExperts);
  const connectorStates = useImConnectorStore((state) => state.states);
  const refreshConnectors = useImConnectorStore((state) => state.refresh);
  const [draftName, setDraftName] = useState<string>(EMPTY);
  const [draftDescription, setDraftDescription] = useState<string>(EMPTY);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState<string>(EMPTY);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedExperts, setSelectedExperts] = useState<string[]>([]);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const [expandedBinding, setExpandedBinding] = useState<"skills" | "experts" | "connectors" | null>(null);
  const [bindingQuery, setBindingQuery] = useState(EMPTY);
  // 协作已并入项目模块：项目页内嵌协作入口（侧边栏不再单独暴露 Collab）。
  const [showCollab, setShowCollab] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const [ideaText, setIdeaText] = useState(EMPTY);
  const [listScope, setListScope] = useState<ProjectListScope>("all");

  useEffect(() => {
    refreshConnectors();
    void fetchExperts();
  }, [refreshConnectors, fetchExperts]);

  const visibleProjects = useMemo(() => {
    const scoped = filterProjectsByScope(projects, listScope);
    const q = query.trim().toLowerCase();
    if (!q) {
      return scoped;
    }
    return scoped.filter(
      (project) =>
        project.name.toLowerCase().includes(q) || project.description.toLowerCase().includes(q),
    );
  }, [projects, query, listScope]);

  const handleCreateFromIdea = () => {
    const idea = ideaText.trim();
    if (!idea) {
      return;
    }
    const name = idea.length > 24 ? `${idea.slice(0, 24)}…` : idea;
    const id = createProject(name, idea);
    setIdeaText(EMPTY);
    setSelectedProjectId(id);
  };

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    const id = createProject(name, draftDescription.trim(), {
      skills: selectedSkills,
      experts: selectedExperts,
      connectors: selectedConnectors,
    });
    setDraftName(EMPTY);
    setDraftDescription(EMPTY);
    setSelectedSkills([]);
    setSelectedExperts([]);
    setSelectedConnectors([]);
    setCreateOpen(false);
    setSelectedProjectId(id);
  };

  const handleTemplateSelect = (templateId: string) => {
    // Create project with template metadata in description
    const templateNames: Record<string, string> = {
      "react-vite": "React + TypeScript + Vite",
      "node-express": "Node.js + Express + TypeScript",
      "python-fastapi": "Python + FastAPI",
      "nextjs-app-router": "Next.js App Router",
      "vue-vite": "Vue 3 + TypeScript + Vite",
    };
    const templateName = templateNames[templateId] || templateId;
    const projectName = `My ${templateName} Project`;
    const description = `Created from ${templateName} template`;
    
    const id = createProject(projectName, description);
    setShowTemplateWizard(false);
    setSelectedProjectId(id);
  };

  const toggleBinding = (type: "skills" | "experts" | "connectors", id: string) => {
    if (type === "skills") {
      setSelectedSkills((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else if (type === "experts") {
      setSelectedExperts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelectedConnectors((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
  };

  const filteredSkills = useMemo(() => {
    const q = bindingQuery.trim().toLowerCase();
    if (!q) return SKILL_CATALOG;
    return SKILL_CATALOG.filter((s) =>
      [s.name, s.description, s.category, ...s.tags].join(" ").toLowerCase().includes(q),
    );
  }, [bindingQuery]);

  const filteredExperts = useMemo(() => {
    const q = bindingQuery.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter((e) =>
      [e.name, e.description].join(" ").toLowerCase().includes(q),
    );
  }, [bindingQuery, experts]);

  const filteredConnectors = useMemo(() => {
    const q = bindingQuery.trim().toLowerCase();
    const all = IM_CONNECTOR_DEFINITIONS.map((def) => ({
      id: def.id,
      status: connectorStates.find((s) => s.id === def.id)?.status ?? "disconnected",
    }));
    if (!q) return all;
    return all.filter((c) => {
      const def = IM_CONNECTOR_DEFINITIONS.find((d) => d.id === c.id);
      return (def?.name ?? c.id).toLowerCase().includes(q);
    });
  }, [bindingQuery, connectorStates]);

  const totalBindings = selectedSkills.length + selectedExperts.length + selectedConnectors.length;

  if (selectedProjectId) {
    return (
      <ProjectDetailPanel
        projectId={selectedProjectId}
        onClose={props.onClose}
        onBack={() => setSelectedProjectId(null)}
        workspaceId={props.workspaceId}
        workspaceRoot={props.workspaceRoot}
        canCreateTask={props.canCreateTask}
        client={props.client}
        getThreadSurface={props.getThreadSurface}
        createThread={props.createThread}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold">{t("projects.title")}</h2>
        </div>
        <div className="flex items-center gap-1">
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={t("common.close")} aria-label={t("common.close")}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      {/* WorkBuddy 风格 Hero 区域 */}
      <div className="border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-primary/3 px-4 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <FolderKanban className="size-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">项目管理</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              创建项目、拆解计划、跟踪进度，让团队协作更高效
            </p>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
            <Badge variant="outline" className="gap-1 text-[10px]">
              {props.workspaceType === "remote" ? <Cloud size={10} /> : <HardDrive size={10} />}
              {props.workspaceType === "remote" ? t("projects.env_remote") : t("projects.env_local")}
            </Badge>
            <span className={cn(
              "size-1.5 rounded-full",
              props.serverConnected === false ? "bg-rose-500" : "bg-emerald-500",
            )} />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowTemplateWizard(true)}
            >
              <LayoutTemplate size={14} className="mr-1" />
              {t("projects.create_from_template")}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" />
              {t("projects.new_project")}
            </Button>
          </div>
        </div>

        {/* 对话创建 */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
          <Sparkles size={16} className="shrink-0 text-primary" />
          <input
            value={ideaText}
            onChange={(event) => setIdeaText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreateFromIdea();
            }}
            placeholder={t("projects.dialog_create_placeholder")}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <Button size="sm" variant="outline" onClick={handleCreateFromIdea} disabled={ideaText.trim().length === 0}>
            {t("projects.create")}
          </Button>
        </div>

        {/* 我加入的 / 全部 */}
        <div className="mt-3 flex items-center gap-1">
          {([
            { id: "joined" as const, label: t("projects.scope_joined") },
            { id: "all" as const, label: t("projects.scope_all") },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setListScope(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                listScope === tab.id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("projects.search_placeholder")}
              className="h-8 w-full rounded-lg border border-border bg-input/50 pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("projects.new_project")}</DialogTitle>
            <DialogDescription>{t("projects.new_project_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={t("projects.name_placeholder")}
              className="h-9 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setDraftName(tpl.name);
                    setDraftDescription(tpl.description);
                  }}
                  className={cn(
                    "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground",
                    draftName === tpl.name && "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  {tpl.icon} {tpl.name}
                </button>
              ))}
            </div>
            <textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder={t("projects.desc_placeholder")}
              rows={3}
              className="w-full rounded-lg border border-border bg-input/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />

            {/* Binding selectors */}
            <div className="space-y-1.5">
              {([
                { type: "skills" as const, icon: Wrench, label: t("projects.bind_skills"), count: selectedSkills.length },
                { type: "experts" as const, icon: Bot, label: t("projects.bind_experts"), count: selectedExperts.length },
                { type: "connectors" as const, icon: MessagesSquare, label: t("projects.bind_connectors"), count: selectedConnectors.length },
              ]).map(({ type, icon: Icon, label, count }) => (
                <div key={type} className="rounded-lg border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
                    onClick={() => {
                      setExpandedBinding(expandedBinding === type ? null : type);
                      setBindingQuery(EMPTY);
                    }}
                  >
                    <Icon size={13} className="text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    {count > 0 ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
                    ) : null}
                    <ChevronDown size={12} className={cn("text-muted-foreground transition-transform", expandedBinding === type && "rotate-180")} />
                  </button>
                  {expandedBinding === type ? (
                    <div className="border-t border-border px-3 py-2">
                      <input
                        value={bindingQuery}
                        onChange={(e) => setBindingQuery(e.target.value)}
                        placeholder={t(`projects.bind_${type}_placeholder`)}
                        className="mb-2 h-7 w-full rounded border border-border bg-input/50 px-2 text-[11px] outline-none focus-visible:border-ring"
                      />
                      <div className="max-h-32 space-y-0.5 overflow-y-auto">
                        {type === "skills" && filteredSkills.length === 0 ? (
                          <p className="py-2 text-center text-[11px] text-muted-foreground">{t("projects.bind_empty_skills")}</p>
                        ) : null}
                        {type === "experts" && filteredExperts.length === 0 ? (
                          <p className="py-2 text-center text-[11px] text-muted-foreground">{t("projects.bind_empty_experts")}</p>
                        ) : null}
                        {type === "connectors" && filteredConnectors.length === 0 ? (
                          <p className="py-2 text-center text-[11px] text-muted-foreground">{t("projects.bind_empty_connectors")}</p>
                        ) : null}
                        {type === "skills" ? filteredSkills.map((skill) => (
                          <label key={skill.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-muted/50">
                            <input
                              type="checkbox"
                              checked={selectedSkills.includes(skill.id)}
                              onChange={() => toggleBinding("skills", skill.id)}
                              className="size-3 rounded border-border accent-primary"
                            />
                            <span className="truncate">{skill.description}</span>
                          </label>
                        )) : null}
                        {type === "experts" ? filteredExperts.map((expert) => (
                          <label key={expert.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-muted/50">
                            <input
                              type="checkbox"
                              checked={selectedExperts.includes(expert.id)}
                              onChange={() => toggleBinding("experts", expert.id)}
                              className="size-3 rounded border-border accent-primary"
                            />
                            <span className="truncate">{expert.name}</span>
                          </label>
                        )) : null}
                        {type === "connectors" ? filteredConnectors.map((connector) => {
                          const def = IM_CONNECTOR_DEFINITIONS.find((d) => d.id === connector.id);
                          return (
                            <label key={connector.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-muted/50">
                              <input
                                type="checkbox"
                                checked={selectedConnectors.includes(connector.id)}
                                onChange={() => toggleBinding("connectors", connector.id)}
                                className="size-3 rounded border-border accent-primary"
                              />
                              <span className="truncate">{def?.name ?? connector.id}</span>
                              <span className={cn(
                                "ml-auto size-1.5 shrink-0 rounded-full",
                                connector.status === "connected" ? "bg-emerald-500"
                                  : connector.status === "connecting" ? "bg-amber-500"
                                    : "bg-muted-foreground",
                              )} />
                            </label>
                          );
                        }) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={draftName.trim().length === 0}>{t("projects.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTemplateWizard && (
        <TemplateWizard
          onSelect={handleTemplateSelect}
          onCancel={() => setShowTemplateWizard(false)}
        />
      )}

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          {visibleProjects.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {query ? t("projects.no_search_results") : t("projects.no_projects")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
              {visibleProjects.map((project) => {
                const totalTasks = countTasks(project);
                const doneTasks = countDoneTasks(project);
                const pct = progress(project);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
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
                          <CardTitle className="line-clamp-1 text-sm">{project.name}</CardTitle>
                          <Badge variant={statusVariant[project.status]}>
                            {t(statusLabel[project.status])}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {project.description || t("projects.no_description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{t("projects.plans", { count: project.plans.length })}</span>
                          <span>·</span>
                          <span>{t("projects.tasks", { count: totalTasks })}</span>
                          {totalTasks > 0 ? (
                            <>
                              <span>·</span>
                              <span>{t("projects.tasks_done", { count: doneTasks })}</span>
                            </>
                          ) : null}
                        </div>
                        {(project.skills.length > 0 || project.experts.length > 0 || project.connectors.length > 0) ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Wrench size={10} />
                              {project.skills.length}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Bot size={10} />
                              {project.experts.length}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MessagesSquare size={10} />
                              {project.connectors.length}
                            </span>
                          </div>
                        ) : null}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                          <span className="line-clamp-1">{recentActivityLabel(project)}</span>
                        </div>
                        {projectCardDateLabel(project) ? (
                          <div className="text-[11px] text-muted-foreground">
                            {t("projects.updated_at", { date: projectCardDateLabel(project) })}
                          </div>
                        ) : null}
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