/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Globe,
  MessageCircle,
  MessagesSquare,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Store,
  Unplug,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentLocale } from "../../../i18n";
import { MCP_QUICK_CONNECT, getMcpServerName } from "@/app/constants";
import { FRIENDLY_PROVIDER_LABELS } from "@/app/utils";
import { cn } from "@/lib/utils";

import { useOrgMcpConnections } from "../connections/use-org-mcp-connections";
import { connectionNeedsReconnect } from "../connections/native-provider-connections";
import { ExpertCard } from "../experts/expert-card";
import { ExpertDetailDialog } from "../experts/expert-detail-dialog";
import { ExpertFormDialog, type ExpertFormLabels } from "../experts/expert-form";
import { filterExperts, useExpertsStore } from "../experts/experts-store";
import type { Expert } from "../experts/types";
import { EXPERT_CATEGORIES, filterExpertsByCategory } from "../experts/expert-taxonomy";
import { SkillMarketplacePage } from "../skills/skill-marketplace-page";
import { AutomationBuilder } from "../browser/automation-builder";
import { IM_CONNECTOR_DEFINITIONS, useImConnectorStore } from "../settings/im-connector-store";
import { formatStatusLabel, formatStatusTone } from "../settings/im-connector-state";

// ---------- Connectors 视图投影（纯逻辑，可测试） ----------

export type ConnectorKind = "mcp" | "provider";
export type ConnectorStatus = "connected" | "needs_reconnect" | "available";
export type ConnectorSource = "org" | "catalog" | "builtin";

export type ConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: ConnectorKind;
  status: ConnectorStatus;
  source: ConnectorSource;
  iconSrc?: string;
};

export type ConnectorView = {
  mcpConnected: ConnectorItem[];
  mcpNeedsReconnect: ConnectorItem[];
  mcpAvailable: ConnectorItem[];
  providers: ConnectorItem[];
};

export type BuildConnectorViewInput = {
  orgConnections: Array<{
    id: string;
    name: string;
    description?: string;
    connected: boolean;
    needsReconnect?: boolean;
  }>;
  catalog: Array<{ id: string; name: string; description: string; iconSrc?: string }>;
  providers: Array<{ id: string; name: string }>;
};

/** 把"已连接的 org 连接 + 可连接的快捷目录 + 模型 Provider"投影为市场视图。 */
export function buildConnectorView(input: BuildConnectorViewInput): ConnectorView {
  const mcpConnected: ConnectorItem[] = [];
  const mcpNeedsReconnect: ConnectorItem[] = [];
  const mcpAvailable: ConnectorItem[] = [];
  const providers: ConnectorItem[] = [];

  const claimedByOrg = new Set<string>();

  for (const connection of input.orgConnections) {
    const base = {
      id: connection.id,
      name: connection.name,
      description: connection.description ?? "",
      kind: "mcp" as const,
      source: "org" as const,
    };
    if (connection.needsReconnect) {
      mcpNeedsReconnect.push({ ...base, status: "needs_reconnect" });
    } else if (connection.connected) {
      mcpConnected.push({ ...base, status: "connected" });
    } else {
      mcpAvailable.push({ ...base, status: "available" });
    }
    claimedByOrg.add(connection.id);
  }

  for (const entry of input.catalog) {
    if (claimedByOrg.has(entry.id)) continue;
    mcpAvailable.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      kind: "mcp",
      status: "available",
      source: "catalog",
      iconSrc: entry.iconSrc,
    });
  }

  for (const provider of input.providers) {
    providers.push({
      id: provider.id,
      name: provider.name,
      description: provider.id,
      kind: "provider",
      status: "available",
      source: "builtin",
    });
  }

  return { mcpConnected, mcpNeedsReconnect, mcpAvailable, providers };
}

// ---------- 页面级双语字典（不触碰全局 locales） ----------

const MARKETPLACE_DICT = {
  zh: {
    "marketplace.title": "能力市场",
    "marketplace.subtitle": "浏览、安装和管理你工作所需的全部能力 —— 从内置技能到外部连接器，再到自定义智能体。",
    "marketplace.tabs.skills": "技能",
    "marketplace.tabs.connectors": "连接器",
    "marketplace.tabs.agents": "专家应用",
    "marketplace.tabs.browser": "浏览器自动化",
    "marketplace.browser.title": "浏览器自动化构建器",
    "marketplace.browser.subtitle": "创建、保存和执行浏览器自动化脚本",
    "marketplace.connectors.searchPlaceholder": "搜索连接器…",
    "marketplace.connectors.source.all": "全部",
    "marketplace.connectors.source.im": "IM 消息",
    "marketplace.connectors.source.third": "第三方集成",
    "marketplace.connectors.section.mcp": "MCP 连接器",
    "marketplace.connectors.section.providers": "模型 Provider",
    "marketplace.connectors.status.connected": "已连接",
    "marketplace.connectors.status.needsReconnect": "需要重连",
    "marketplace.connectors.status.available": "可连接",
    "marketplace.connectors.manage": "管理",
    "marketplace.connectors.connect": "连接",
    "marketplace.connectors.loading": "正在加载连接器…",
    "marketplace.connectors.refresh": "刷新",
    "marketplace.connectors.empty": "没有匹配的连接器。",
    "marketplace.agents.searchPlaceholder": "搜索智能体…",
    "marketplace.agents.newExpert": "新建专家",
    "marketplace.agents.emptyTitle": "暂无智能体",
    "marketplace.agents.emptyHint": "创建自定义专家，赋予它专属技能、工具和知识。",
    "marketplace.agents.loadFailed": "加载智能体失败：{error}",
    "marketplace.agents.loading": "正在加载智能体…",
    "marketplace.agents.retry": "重试",
    "marketplace.agents.count": "{count} 位专家",
    "marketplace.expertForm.titleCreate": "新建专家",
    "marketplace.expertForm.titleEdit": "编辑专家",
    "marketplace.expertForm.subtitle": "配置专家的角色、能力与工作方法。",
    "marketplace.expertForm.name": "名称",
    "marketplace.expertForm.namePlaceholder": "例如：代码审查专家",
    "marketplace.expertForm.nameRequired": "请填写专家名称。",
    "marketplace.expertForm.description": "描述",
    "marketplace.expertForm.descriptionPlaceholder": "一句话说明专家的职责",
    "marketplace.expertForm.category": "分类",
    "marketplace.expertForm.systemPrompt": "System Prompt",
    "marketplace.expertForm.systemPromptPlaceholder": "定义专家的系统指令…",
    "marketplace.expertForm.systemPromptRequired": "请填写 System Prompt。",
    "marketplace.expertForm.methodology": "工作方法",
    "marketplace.expertForm.methodologyPlaceholder": "描述专家处理任务的流程与原则（可选）",
    "marketplace.expertForm.skills": "绑定技能",
    "marketplace.expertForm.skillsHint": "从本地技能目录中多选，供专家调用。",
    "marketplace.expertForm.model": "推荐模型",
    "marketplace.expertForm.modelPlaceholder": "例如：deepseek-coder",
    "marketplace.expertForm.save": "保存",
    "marketplace.expertForm.saving": "保存中…",
    "marketplace.expertForm.cancel": "取消",
    "marketplace.expertForm.close": "关闭",
    "marketplace.expertForm.back": "返回",
    "marketplace.expertForm.saveFailed": "保存失败，请重试。",
  },
  en: {
    "marketplace.title": "Marketplace",
    "marketplace.subtitle": "Browse, install, and manage every capability you need — from built-in skills to external connectors and custom agents.",
    "marketplace.tabs.skills": "Skills",
    "marketplace.tabs.connectors": "Connectors",
    "marketplace.tabs.agents": "Expert Apps",
    "marketplace.tabs.browser": "Browser Automation",
    "marketplace.browser.title": "Browser Automation Builder",
    "marketplace.browser.subtitle": "Create, save, and run browser automation scripts",
    "marketplace.connectors.searchPlaceholder": "Search connectors…",
    "marketplace.connectors.source.all": "All",
    "marketplace.connectors.source.im": "IM messaging",
    "marketplace.connectors.source.third": "Integrations",
    "marketplace.connectors.section.mcp": "MCP Connectors",
    "marketplace.connectors.section.providers": "Model Providers",
    "marketplace.connectors.status.connected": "Connected",
    "marketplace.connectors.status.needsReconnect": "Reconnect needed",
    "marketplace.connectors.status.available": "Available",
    "marketplace.connectors.manage": "Manage",
    "marketplace.connectors.connect": "Connect",
    "marketplace.connectors.loading": "Loading connectors…",
    "marketplace.connectors.refresh": "Refresh",
    "marketplace.connectors.empty": "No connectors match your search.",
    "marketplace.agents.searchPlaceholder": "Search agents…",
    "marketplace.agents.newExpert": "New Expert",
    "marketplace.agents.emptyTitle": "No agents yet",
    "marketplace.agents.emptyHint": "Create a custom expert with its own skills, tools, and knowledge.",
    "marketplace.agents.loadFailed": "Failed to load agents: {error}",
    "marketplace.agents.loading": "Loading agents…",
    "marketplace.agents.retry": "Retry",
    "marketplace.agents.count": "{count} experts",
    "marketplace.expertForm.titleCreate": "New Expert",
    "marketplace.expertForm.titleEdit": "Edit Expert",
    "marketplace.expertForm.subtitle": "Configure the expert's role, capabilities, and methodology.",
    "marketplace.expertForm.name": "Name",
    "marketplace.expertForm.namePlaceholder": "e.g., Code Review Expert",
    "marketplace.expertForm.nameRequired": "Name is required.",
    "marketplace.expertForm.description": "Description",
    "marketplace.expertForm.descriptionPlaceholder": "One line about what this expert does",
    "marketplace.expertForm.category": "Category",
    "marketplace.expertForm.systemPrompt": "System Prompt",
    "marketplace.expertForm.systemPromptPlaceholder": "Define the expert's system instructions…",
    "marketplace.expertForm.systemPromptRequired": "System Prompt is required.",
    "marketplace.expertForm.methodology": "Methodology",
    "marketplace.expertForm.methodologyPlaceholder": "How the expert approaches tasks (optional)",
    "marketplace.expertForm.skills": "Bound Skills",
    "marketplace.expertForm.skillsHint": "Select skills from the local catalog the expert can call.",
    "marketplace.expertForm.model": "Recommended model",
    "marketplace.expertForm.modelPlaceholder": "e.g., deepseek-coder",
    "marketplace.expertForm.save": "Save",
    "marketplace.expertForm.saving": "Saving…",
    "marketplace.expertForm.cancel": "Cancel",
    "marketplace.expertForm.close": "Close",
    "marketplace.expertForm.back": "Back",
    "marketplace.expertForm.saveFailed": "Save failed. Please try again.",
  },
} as const;

type MarketplaceDictKey = keyof (typeof MARKETPLACE_DICT)["zh"];
type MarketplaceDict = Record<MarketplaceDictKey, string>;

const pickDict = (): MarketplaceDict => (currentLocale() === "zh" ? MARKETPLACE_DICT.zh : MARKETPLACE_DICT.en);

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

// ---------- 页面 ----------

type MarketplaceTab = "skills" | "connectors" | "agents" | "browser";

export type MarketplacePageProps = {
  onClose?: () => void;
  initialTab?: MarketplaceTab;
  workspaceRoot?: string;
  client?: unknown;
  /** 由宿主注入：以给定提示词发起一个真实会话（专家召唤 / 开始任务）。 */
  onStartTask?: (prompt: string) => void;
  /**
   * 连接器"管理/连接"入口（缺省 no-op）。
   * TODO 联调：由宿主注入打开对应连接配置/授权流程。
   */
  onManageConnector?: (item: ConnectorItem) => void;
};

export function MarketplacePage(props: MarketplacePageProps) {
  const dict = pickDict();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>(props.initialTab ?? "agents");
  const [connectorsSearch, setConnectorsSearch] = useState("");
  const [connectorsSource, setConnectorsSource] = useState<"all" | "im" | "third">("all");
  const [agentsSearch, setAgentsSearch] = useState("");
  const [agentsCategory, setAgentsCategory] = useState<string>("全部");
  const [detailExpert, setDetailExpert] = useState<Expert | null>(null);
  const [expertDialogOpen, setExpertDialogOpen] = useState(false);

  // ---- IM 连接器数据 ----
  const imConnectorStates = useImConnectorStore((state) => state.states);
  const refreshImConnectors = useImConnectorStore((state) => state.refresh);

  useEffect(() => {
    refreshImConnectors();
  }, [refreshImConnectors]);

  // ---- 真实连接器数据（org 连接 + 快捷目录 + 模型 Provider） ----
  const orgConnections = useOrgMcpConnections();

  const connectorView = useMemo<ConnectorView>(
    () =>
      buildConnectorView({
        orgConnections: orgConnections.connections.map((connection) => ({
          id: connection.id,
          name: connection.name,
          description: connection.url,
          connected:
            connection.credentialMode === "shared" ? connection.connected : connection.connectedForMe,
          needsReconnect: connectionNeedsReconnect(connection),
        })),
        catalog: MCP_QUICK_CONNECT.filter(
          (entry) => !entry.defaultHidden && entry.kind !== "extension" && entry.kind !== "ui-control",
        ).map((entry) => ({
          id: entry.serverName ?? getMcpServerName(entry),
          name: entry.name,
          description: entry.description,
          iconSrc: entry.iconSrc,
        })),
        providers: Object.entries(FRIENDLY_PROVIDER_LABELS).map(([id, name]) => ({ id, name })),
      }),
    [orgConnections.connections],
  );

  const connectorItems = useMemo(() => {
    const terms = connectorsSearch.trim().toLowerCase();
    const matches = (item: ConnectorItem) =>
      !terms || item.name.toLowerCase().includes(terms) || item.description.toLowerCase().includes(terms);
    return {
      mcpConnected: connectorView.mcpConnected.filter(matches),
      mcpNeedsReconnect: connectorView.mcpNeedsReconnect.filter(matches),
      mcpAvailable: connectorView.mcpAvailable.filter(matches),
      providers: connectorView.providers.filter(matches),
    };
  }, [connectorView, connectorsSearch]);

  // ---- 真实智能体数据（/api/experts，experts-store） ----
  const experts = useExpertsStore((state) => state.experts);
  const expertsStatus = useExpertsStore((state) => state.status);
  const expertsError = useExpertsStore((state) => state.error);
  const fetchExperts = useExpertsStore((state) => state.fetchExperts);
  const createExpert = useExpertsStore((state) => state.createExpert);

  useEffect(() => {
    void fetchExperts();
  }, [fetchExperts]);

  const filteredExperts = useMemo(
    () => filterExperts(filterExpertsByCategory(experts, agentsCategory), agentsSearch),
    [experts, agentsSearch, agentsCategory],
  );

  const expertFormLabels = useMemo<ExpertFormLabels>(
    () => ({
      titleCreate: dict["marketplace.expertForm.titleCreate"],
      titleEdit: dict["marketplace.expertForm.titleEdit"],
      subtitle: dict["marketplace.expertForm.subtitle"],
      name: dict["marketplace.expertForm.name"],
      namePlaceholder: dict["marketplace.expertForm.namePlaceholder"],
      nameRequired: dict["marketplace.expertForm.nameRequired"],
      description: dict["marketplace.expertForm.description"],
      descriptionPlaceholder: dict["marketplace.expertForm.descriptionPlaceholder"],
      category: dict["marketplace.expertForm.category"],
      systemPrompt: dict["marketplace.expertForm.systemPrompt"],
      systemPromptPlaceholder: dict["marketplace.expertForm.systemPromptPlaceholder"],
      systemPromptRequired: dict["marketplace.expertForm.systemPromptRequired"],
      methodology: dict["marketplace.expertForm.methodology"],
      methodologyPlaceholder: dict["marketplace.expertForm.methodologyPlaceholder"],
      skills: dict["marketplace.expertForm.skills"],
      skillsHint: dict["marketplace.expertForm.skillsHint"],
      model: dict["marketplace.expertForm.model"],
      modelPlaceholder: dict["marketplace.expertForm.modelPlaceholder"],
      save: dict["marketplace.expertForm.save"],
      saving: dict["marketplace.expertForm.saving"],
      cancel: dict["marketplace.expertForm.cancel"],
      close: dict["marketplace.expertForm.close"],
      back: dict["marketplace.expertForm.back"],
      saveFailed: dict["marketplace.expertForm.saveFailed"],
    }),
    [dict],
  );

  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4">
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-primary" />
          <h1 className="font-heading text-lg font-medium">{dict["marketplace.title"]}</h1>
          <span className="text-xs text-muted-foreground">
            {dict["marketplace.tabs.skills"]} · {dict["marketplace.tabs.connectors"]} · {dict["marketplace.tabs.agents"]} · {dict["marketplace.tabs.browser"]}
          </span>
        </div>
        <p className="text-sm text-dls-secondary">{dict["marketplace.subtitle"]}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MarketplaceTab)}
        className="flex-1 overflow-auto"
      >
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="size-4" />
            {dict["marketplace.tabs.agents"]}
          </TabsTrigger>
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <Plug className="size-4" />
            {dict["marketplace.tabs.connectors"]}
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {dict["marketplace.tabs.skills"]}
          </TabsTrigger>
          <TabsTrigger value="browser" className="flex items-center gap-2">
            <Globe className="size-4" />
            {dict["marketplace.tabs.browser"]}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="m-0">
          <SkillMarketplacePage onClose={props.onClose} workspaceRoot={props.workspaceRoot} />
        </TabsContent>

        <TabsContent value="connectors" className="m-0">
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={dict["marketplace.connectors.searchPlaceholder"]}
              value={connectorsSearch}
              onChange={(event) => setConnectorsSearch(event.target.value)}
              aria-label={dict["marketplace.connectors.searchPlaceholder"]}
            />
          </div>

          <div className="mb-4 flex gap-1.5">
            {([
              { id: "all", label: dict["marketplace.connectors.source.all"] },
              { id: "im", label: dict["marketplace.connectors.source.im"] },
              { id: "third", label: dict["marketplace.connectors.source.third"] },
            ] as const).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setConnectorsSource(chip.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  connectorsSource === chip.id
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {(connectorsSource === "all" || connectorsSource === "im") ? (
            <>
            {/* IM 连接器（优先展示） */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <MessagesSquare size={14} />
                IM {dict["marketplace.tabs.connectors"]}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {IM_CONNECTOR_DEFINITIONS.map((def) => {
                  const state = imConnectorStates.find((s) => s.id === def.id);
                  const status = state?.status ?? "disconnected";
                  const Icon = def.icon;
                  return (
                    <Card key={def.id} className="rounded-xl bg-card/50 transition-all hover:ring-2 hover:ring-primary/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className={cn(
                                "flex size-10 items-center justify-center rounded-xl",
                                status === "connected" ? "bg-primary/10 text-primary" : "bg-muted",
                              )}>
                                <Icon className="size-4" />
                              </div>
                              <span className={cn(
                                "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card",
                                status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-amber-500" : "bg-muted-foreground/30",
                              )} />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-medium">{def.name}</CardTitle>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{def.description.slice(0, 20)}…</p>
                            </div>
                          </div>
                          <Badge variant={formatStatusTone(status)} className="text-[10px]">
                            {formatStatusLabel(status)}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-2 leading-relaxed line-clamp-2">
                          {def.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
            </>
            ) : null}

            {/* 第三方集成 (MCP) */}
            {(connectorsSource === "all" || connectorsSource === "third") ? (
            <>
            {orgConnections.loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {dict["marketplace.connectors.loading"]}
              </p>
            ) : (
              <>
                <ConnectorSection
                  title={dict["marketplace.connectors.section.mcp"]}
                  groups={[
                    { items: connectorItems.mcpConnected, status: "connected" },
                    { items: connectorItems.mcpNeedsReconnect, status: "needs_reconnect" },
                    { items: connectorItems.mcpAvailable, status: "available" },
                  ]}
                  dict={dict}
                  onManage={props.onManageConnector}
                />
                <ConnectorSection
                  title={dict["marketplace.connectors.section.providers"]}
                  groups={[{ items: connectorItems.providers, status: "available" }]}
                  dict={dict}
                  onManage={props.onManageConnector}
                />
              </>
            )}
            </>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="m-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={dict["marketplace.agents.searchPlaceholder"]}
                value={agentsSearch}
                onChange={(event) => setAgentsSearch(event.target.value)}
                aria-label={dict["marketplace.agents.searchPlaceholder"]}
              />
            </div>
            <Button variant="outline" size="sm" className="ml-3 gap-1.5 h-9 shrink-0" onClick={() => setExpertDialogOpen(true)}>
              <Plus className="size-3.5" />
              {dict["marketplace.agents.newExpert"]}
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {["全部", ...EXPERT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setAgentsCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  agentsCategory === cat
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {expertsStatus === "error" ? (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
              <span>{format(dict["marketplace.agents.loadFailed"], { error: expertsError ?? "" })}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchExperts()}>
                {dict["marketplace.agents.retry"]}
              </Button>
            </div>
          ) : null}

          {expertsStatus === "loading" && experts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {dict["marketplace.agents.loading"]}
            </p>
          ) : null}

          {experts.length === 0 && expertsStatus !== "loading" && expertsStatus !== "error" ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border">
              <Bot className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{dict["marketplace.agents.emptyTitle"]}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                {dict["marketplace.agents.emptyHint"]}
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5 h-9" onClick={() => setExpertDialogOpen(true)}>
                <Plus className="size-3.5" />
                {dict["marketplace.agents.newExpert"]}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserRound size={12} />
                <span>{format(dict["marketplace.agents.count"], { count: String(experts.length) })}</span>
              </div>
              {filteredExperts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                  {dict["marketplace.agents.searchPlaceholder"]}
                </div>
              ) : (
                <ScrollArea className="max-h-[calc(100vh-320px)]">
                  <ScrollAreaViewport>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {filteredExperts.map((expert) => (
                        <ExpertCard key={expert.id} expert={expert} onOpen={(next) => setDetailExpert(next)} />
                      ))}
                    </div>
                  </ScrollAreaViewport>
                </ScrollArea>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="browser" className="m-0">
          <div className="flex flex-col gap-2 pt-2 pb-4">
            <div>
              <h2 className="font-heading text-base font-medium">{dict["marketplace.browser.title"]}</h2>
              <p className="text-sm text-dls-secondary mt-1">{dict["marketplace.browser.subtitle"]}</p>
            </div>
            <div className="flex-1 min-h-[500px]">
              <AutomationBuilder />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ExpertFormDialog
        open={expertDialogOpen}
        onOpenChange={setExpertDialogOpen}
        labels={expertFormLabels}
        onSubmit={async (input) => {
          await createExpert(input);
          setExpertDialogOpen(false);
        }}
      />

      <ExpertDetailDialog
        expert={detailExpert}
        open={detailExpert !== null}
        onOpenChange={(next) => {
          if (!next) setDetailExpert(null);
        }}
        workspaceRoot={props.workspaceRoot}
        onStartTask={props.onStartTask}
      />
    </div>
  );
}

// ---------- Connectors 展示 ----------

function ConnectorSection({
  title,
  groups,
  dict,
  onManage,
}: {
  title: string;
  groups: Array<{ items: ConnectorItem[]; status: ConnectorStatus }>;
  dict: MarketplaceDict;
  onManage?: (item: ConnectorItem) => void;
}) {
  const visible = groups.flatMap((group) =>
    group.items.map((item) => ({ item, status: group.status })),
  );

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {dict["marketplace.connectors.empty"]}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ item, status }) => (
            <ConnectorCard
              key={`${item.kind}:${item.id}`}
              item={item}
              statusLabel={statusLabel(dict, status)}
              actionLabel={status === "available" ? dict["marketplace.connectors.connect"] : dict["marketplace.connectors.manage"]}
              onManage={onManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(dict: MarketplaceDict, status: ConnectorStatus): string {
  switch (status) {
    case "connected":
      return dict["marketplace.connectors.status.connected"];
    case "needs_reconnect":
      return dict["marketplace.connectors.status.needsReconnect"];
    case "available":
      return dict["marketplace.connectors.status.available"];
  }
}

function ConnectorCard({
  item,
  statusLabel: statusText,
  actionLabel,
  onManage,
}: {
  item: ConnectorItem;
  statusLabel: string;
  actionLabel: string;
  onManage?: (item: ConnectorItem) => void;
}) {
  const isConnected = item.status === "connected";
  const needsReconnect = item.status === "needs_reconnect";
  const isAvailable = item.status === "available";
  const Icon = item.kind === "provider" ? Bot : item.source === "org" ? Plug : Unplug;

  return (
    <Card className="rounded-xl bg-card/50 transition-all hover:ring-2 hover:ring-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                isConnected ? "bg-primary/10 text-primary" : "bg-muted",
              )}>
                {item.iconSrc ? (
                  <img src={item.iconSrc} alt="" loading="lazy" className="size-5 object-contain" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card",
                isConnected ? "bg-green-500" : needsReconnect ? "bg-amber-500" : "bg-muted-foreground/30",
              )} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">{item.kind === "mcp" ? "MCP" : "Provider"}</p>
            </div>
          </div>
          {isAvailable ? (
            <button
              type="button"
              onClick={() => onManage?.(item)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label={actionLabel}
              title={actionLabel}
            >
              <Plus className="size-3.5" />
            </button>
          ) : isConnected ? (
            <button
              type="button"
              onClick={() => onManage?.(item)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              aria-label={actionLabel}
              title={actionLabel}
            >
              <MessageCircle className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onManage?.(item)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              aria-label={actionLabel}
              title={statusText}
            >
              <Settings2 className="size-3.5" />
            </button>
          )}
        </div>
        <CardDescription className="text-xs mt-2 leading-relaxed line-clamp-2">
          {item.description || "—"}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
