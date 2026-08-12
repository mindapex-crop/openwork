/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  Boxes,
  ChevronRight,
  Cpu,
  Layers,
  Plug,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient, unwrap } from "@/app/lib/opencode";
import {
  createOpenworkServerClient,
  type OpenworkServerClient,
} from "@/app/lib/openwork-server";
import type { Client, ModelRef } from "@/app/types";
import { cn } from "@/lib/utils";
import { isDesktopRuntime } from "@/app/utils";
import { t } from "@/i18n";
import { workspaceBootstrap, type WorkspaceInfo, type WorkspaceList } from "@/app/lib/desktop";
import { resolveOpenworkConnection } from "./openwork-connection";
import { useNavigate } from "react-router-dom";
import { useBootState } from "./boot-state";
import {
  createWorkspaceServerClientResolver,
  type WorkspaceServerClientResolver,
} from "@/react-app/infra/workspace-server-client";
import {
  getAllProviderItems,
  useProviderListQuery,
  type ProviderCatalogItem,
} from "@/react-app/infra/provider-list-query";
import type { AgentRuntimeCapability } from "@/app/lib/openwork-server";
import { readActiveWorkspaceId } from "./session-memory";
import {
  SettingsContent,
  SettingsPanel,
  SettingsPanelDescription,
  SettingsPanelHeading,
  SettingsPanelTitle,
  SettingsPanelToolbar,
  SettingsPanelToolbarActions,
  SettingsPanelToolbarButton,
  SettingsPanelToolbarStatus,
} from "@/react-app/domains/settings/shell/panel";
import { ProviderIcon } from "@/react-app/design-system/provider-icon";

const REASONING_LEVELS = ["default", "low", "medium", "high"] as const;

type AdminTab =
  | "overview"
  | "providers"
  | "agents"
  | "models"
  | "custom-models";

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: typeof Server }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "providers", label: "Providers", icon: Plug },
  { id: "agents", label: "CLI Agents", icon: Terminal },
  { id: "models", label: "Models", icon: Layers },
  { id: "custom-models", label: "Custom Models", icon: SlidersHorizontal },
];

export function AdminRoute() {
  const navigate = useNavigate();
  const { markRouteReady } = useBootState();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [openworkClient, setOpenworkClient] = useState<OpenworkServerClient | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshConnection = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);
    let desktopList: WorkspaceList | null = null;
    let desktopWorkspaces: WorkspaceInfo[] = [];
    if (isDesktopRuntime()) {
      try {
        desktopList = (await workspaceBootstrap()) as WorkspaceList;
        desktopWorkspaces = desktopList.workspaces ?? [];
      } catch {
        // Fall through to server list below.
      }
    }
    try {
      const { normalizedBaseUrl, resolvedToken } = await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        setConnectionError(t("app.error_connect_first"));
        setWorkspaces(desktopWorkspaces);
        return;
      }
      const client = createOpenworkServerClient({
        baseUrl: normalizedBaseUrl,
        token: resolvedToken,
      });
      let serverWorkspaces: WorkspaceInfo[] = [];
      try {
        const list = await client.listWorkspaces();
        serverWorkspaces = list.items as unknown as WorkspaceInfo[];
      } catch {
        // Desktop-only mode: rely on the bootstrap list.
      }
      const merged = mergeWorkspaceLists(serverWorkspaces, desktopWorkspaces);
      setOpenworkClient(client);
      setBaseUrl(normalizedBaseUrl);
      setToken(resolvedToken);
      setWorkspaces(merged);
      setSelectedWorkspaceId((current) => {
        if (current && merged.some((w) => w.id === current)) return current;
        const desktopSelected = resolveWorkspaceListSelected(desktopList);
        const active = readActiveWorkspaceId();
        return (
          active && merged.some((w) => w.id === active) ? active :
          desktopSelected && merged.some((w) => w.id === desktopSelected) ? desktopSelected :
          merged[0]?.id ?? ""
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("app.unknown_error");
      setConnectionError(message);
      console.error("[admin-route] connection failed", error);
      setWorkspaces(desktopWorkspaces);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection, refreshKey]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? workspaces[0] ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const resolver = useMemo<WorkspaceServerClientResolver | null>(
    () => (baseUrl && token ? createWorkspaceServerClientResolver({ baseUrl, token }) : null),
    [baseUrl, token],
  );

  const endpoint = useMemo(() => {
    if (!resolver || !selectedWorkspace) return null;
    return resolver(selectedWorkspace);
  }, [resolver, selectedWorkspace]);

  const opencodeClient = useMemo<Client | null>(() => {
    if (!endpoint || !endpoint.token) return null;
    return createClient(endpoint.opencodeBaseUrl, selectedWorkspace?.path || undefined, {
      token: endpoint.token,
      mode: "openwork",
    });
  }, [endpoint, selectedWorkspace?.path]);

  const workspaceRoot = selectedWorkspace?.path?.trim() || "";

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      {/* Left tab rail */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-dls-border bg-sidebar">
        <div className="flex items-center gap-2 border-b border-dls-border px-4 py-3">
          <Wrench className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Admin</div>
            <div className="truncate text-[11px] text-muted-foreground">Backend management</div>
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {ADMIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                tab === item.id
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <ChevronRight className="size-3.5 text-sidebar-foreground/40" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-dls-border p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1 size-3", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-dls-border px-4 mac:titlebar-drag">
          <div className="flex min-w-0 items-center gap-2 mac:titlebar-no-drag">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-11 hover:bg-gray-3 hover:text-gray-12"
              onClick={() => navigate("/session")}
            >
              <ArrowLeft className="size-3.5" />
              {t("app.back_to_session")}
            </button>
            <span className="truncate text-sm font-medium text-dls-text">
              {ADMIN_TABS.find((item) => item.id === tab)?.label}
            </span>
            {selectedWorkspace ? (
              <span className="truncate rounded-full bg-gray-3 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {selectedWorkspace.displayName ?? selectedWorkspace.name ?? selectedWorkspace.id}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 mac:titlebar-no-drag">
            {openworkClient ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-3 px-2.5 py-1 text-[11px] font-medium text-green-11">
                <span className="size-1.5 rounded-full bg-green-9" />
                Server connected
              </span>
            ) : null}
            <Select
              value={selectedWorkspaceId}
              onValueChange={(value) => {
                if (value) setSelectedWorkspaceId(value);
              }}
            >
              <SelectTrigger className="h-7 w-auto max-w-52 gap-1 rounded-md px-2 text-xs">
                <Boxes className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id} className="text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {workspace.displayName ?? workspace.name ?? workspace.id}
                      </span>
                      {workspace.workspaceType === "remote" ? (
                        <span className="shrink-0 rounded bg-blue-3 px-1 text-[9px] text-blue-11">remote</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <SettingsContent>
          {connectionError ? (
            <div className="flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-5/50 bg-red-2/40 px-6 py-8 text-center">
              <Server className="size-8 text-red-10" />
              <p className="text-sm text-red-11">{connectionError}</p>
              <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
                Retry
              </Button>
            </div>
          ) : !opencodeClient ? (
            <div className="text-sm text-muted-foreground">Loading workspace connection…</div>
          ) : (
            <AdminPageBody
              tab={tab}
              opencodeClient={opencodeClient}
              openworkClient={openworkClient}
              workspaceRoot={workspaceRoot}
              baseUrl={baseUrl}
              workspaceId={selectedWorkspaceId}
            />
          )}
        </SettingsContent>
      </main>
    </div>
  );
}

function mergeWorkspaceLists(server: WorkspaceInfo[], desktop: WorkspaceInfo[]): WorkspaceInfo[] {
  const byId = new Map<string, WorkspaceInfo>();
  for (const workspace of [...desktop, ...server]) {
    if (workspace?.id && !byId.has(workspace.id)) byId.set(workspace.id, workspace);
  }
  return [...byId.values()];
}

function resolveWorkspaceListSelected(list: WorkspaceList | null | undefined): string {
  return list?.selectedId ?? list?.activeId ?? "";
}

/* ------------------------------------------------------------------ */
/*  Page body — switches on tab                                       */
/* ------------------------------------------------------------------ */

type AdminPageBodyProps = {
  tab: AdminTab;
  opencodeClient: Client;
  openworkClient: OpenworkServerClient | null;
  workspaceRoot: string;
  baseUrl: string;
  workspaceId: string;
};

function AdminPageBody(props: AdminPageBodyProps) {
  switch (props.tab) {
    case "overview":
      return <OverviewTab {...props} />;
    case "providers":
      return <ProvidersTab {...props} />;
    case "agents":
      return <AgentsTab {...props} />;
    case "models":
      return <ModelsTab {...props} />;
    case "custom-models":
      return <CustomModelsTab {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Overview                                                          */
/* ------------------------------------------------------------------ */

function OverviewTab({ opencodeClient, openworkClient, workspaceRoot }: AdminPageBodyProps) {
  const providerQuery = useProviderListQuery({
    client: opencodeClient,
    directory: workspaceRoot || undefined,
  });
  const catalog = useMemo(() => getAllProviderItems(providerQuery.data), [providerQuery.data]);
  const connectedCount = catalog.filter((item) => item.connected).length;
  const modelCount = catalog.reduce((acc, item) => acc + Object.keys(item.models).length, 0);
  const [agents, setAgents] = useState<AgentRuntimeCapability[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!openworkClient) return;
    openworkClient
      .listAgentRuntimes()
      .then((res) => {
        if (!cancelled) setAgents(res.capabilities ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openworkClient]);

  const availableAgents = agents.filter((agent) => agent.available).length;

  return (
    <div className="grid w-full max-w-3xl gap-4">
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Backend Overview</SettingsPanelTitle>
          <SettingsPanelDescription>
            Providers, CLI agents and models exposed by the local OpenWork engine.
          </SettingsPanelDescription>
        </SettingsPanelHeading>
      </SettingsPanel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Plug} label="Providers" value={String(catalog.length)} detail={`${connectedCount} connected`} />
        <StatCard icon={Layers} label="Models" value={String(modelCount)} detail="across providers" />
        <StatCard icon={Terminal} label="CLI Agents" value={String(agents.length)} detail={`${availableAgents} available`} />
        <StatCard icon={Server} label="Engine" value="Running" detail={openworkClient ? "connected" : "n/a"} />
      </div>

      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Workspace</SettingsPanelTitle>
          <SettingsPanelDescription>
            {workspaceRoot || "No workspace root selected."}
          </SettingsPanelDescription>
        </SettingsPanelHeading>
      </SettingsPanel>
    </div>
  );
}

function StatCard(props: {
  icon: typeof Server;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-dls-border bg-card p-4">
      <props.icon className="size-4 text-muted-foreground" />
      <div className="text-xl font-semibold tracking-tight">{props.value}</div>
      <div className="text-xs text-muted-foreground">
        {props.label}
        {props.detail ? <span className="ml-1 text-muted-foreground/60">· {props.detail}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Providers                                                         */
/* ------------------------------------------------------------------ */

function ProvidersTab({ opencodeClient, workspaceRoot }: AdminPageBodyProps) {
  const providerQuery = useProviderListQuery({
    client: opencodeClient,
    directory: workspaceRoot || undefined,
  });
  const catalog = useMemo(() => getAllProviderItems(providerQuery.data), [providerQuery.data]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        Object.keys(item.models).some((id) => id.toLowerCase().includes(q)),
    );
  }, [catalog, query]);

  return (
    <div className="w-full max-w-3xl space-y-4">
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Providers</SettingsPanelTitle>
          <SettingsPanelDescription>
            {catalog.length} providers in the directory, {catalog.filter((p) => p.connected).length} connected.
          </SettingsPanelDescription>
        </SettingsPanelHeading>
        <SettingsPanelToolbar>
          <Input
            placeholder="Search providers or models…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
        </SettingsPanelToolbar>
      </SettingsPanel>

      <div className="grid gap-2">
        {filtered.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dls-border px-4 py-8 text-center text-sm text-muted-foreground">
            No providers match “{query}”.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderCatalogItem }) {
  const modelIds = Object.keys(provider.models);
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-dls-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dls-hover"
        onClick={() => setExpanded((v) => !v)}
      >
        <ProviderIcon providerId={provider.id} providerName={provider.name} size={20} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{provider.name}</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{provider.id}</div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-3 px-2 py-0.5 text-[11px] text-muted-foreground">
          {modelIds.length} models
        </span>
        {provider.connected ? (
          <span className="shrink-0 rounded-full bg-green-3 px-2 py-0.5 text-[11px] font-medium text-green-11">
            Connected
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-3 px-2 py-0.5 text-[11px] font-medium text-amber-11">
            Not connected
          </span>
        )}
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
        />
      </button>
      {expanded ? (
        <div className="border-t border-dls-border px-4 py-2">
          {modelIds.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {modelIds.map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <span className="truncate text-xs">{provider.models[id]?.name ?? id}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground/60">{id}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No static model catalog — connect the provider to enumerate models.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CLI Agents                                                        */
/* ------------------------------------------------------------------ */

function AgentsTab({ openworkClient }: AdminPageBodyProps) {
  const [agents, setAgents] = useState<AgentRuntimeCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!openworkClient) {
      setError("OpenWork server not connected.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await openworkClient.listAgentRuntimes();
      setAgents(res.capabilities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("app.unknown_error"));
    } finally {
      setLoading(false);
    }
  }, [openworkClient]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full max-w-3xl space-y-4">
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>CLI Agents</SettingsPanelTitle>
          <SettingsPanelDescription>
            Local CLI agent runtimes detected on this machine (auto-discovery + confidence scoring).
          </SettingsPanelDescription>
        </SettingsPanelHeading>
        <SettingsPanelToolbar>
          <SettingsPanelToolbarActions>
            <SettingsPanelToolbarButton onClick={() => void load()} title="Rescan">
              <RefreshCw className={cn("mr-1 size-3", loading && "animate-spin")} />
              Rescan
            </SettingsPanelToolbarButton>
          </SettingsPanelToolbarActions>
        </SettingsPanelToolbar>
      </SettingsPanel>

      {error ? (
        <div className="rounded-2xl border border-red-5/50 bg-red-2/40 px-4 py-3 text-sm text-red-11">{error}</div>
      ) : null}

      <div className="grid gap-2">
        {agents.map((agent) => (
          <AgentCard key={agent.agentId} agent={agent} />
        ))}
        {!loading && agents.length === 0 && !error ? (
          <div className="rounded-2xl border border-dls-border px-4 py-8 text-center text-sm text-muted-foreground">
            No CLI agents detected.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentRuntimeCapability }) {
  const confidence = agent.confidence != null ? Math.round(agent.confidence * 100) : null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-dls-border bg-card px-4 py-3",
        !agent.available && "opacity-60",
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-gray-2">
        <Bot className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{agent.label}</span>
          <span className="rounded bg-gray-3 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {agent.agentId}
          </span>
          {agent.available ? (
            <span className="rounded-full bg-green-3 px-2 py-0.5 text-[10px] font-medium text-green-11">
              Available
            </span>
          ) : (
            <span className="rounded-full bg-amber-3 px-2 py-0.5 text-[10px] font-medium text-amber-11">
              Not installed
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Cpu className="size-3" />
            {agent.protocol}
          </span>
          {agent.vendor ? (
            <span className="flex items-center gap-1">
              <Sparkles className="size-3" />
              {agent.vendor}
            </span>
          ) : null}
          {agent.version ? (
            <span className="font-mono">v{agent.version}</span>
          ) : null}
          {confidence != null ? (
            <span className="font-medium text-blue-11">{confidence}% confidence</span>
          ) : null}
          {agent.defaultModel ? (
            <span className="font-mono">
              default: {agent.defaultModel.providerID}/{agent.defaultModel.modelID}
            </span>
          ) : null}
        </div>
        {agent.binaryPath ? (
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/60">{agent.binaryPath}</div>
        ) : null}
        {agent.error ? (
          <div className="mt-1 text-[11px] text-red-10">{agent.error}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Models catalog                                                    */
/* ------------------------------------------------------------------ */

function ModelsTab({ opencodeClient, workspaceRoot }: AdminPageBodyProps) {
  const providerQuery = useProviderListQuery({
    client: opencodeClient,
    directory: workspaceRoot || undefined,
  });
  const catalog = useMemo(() => getAllProviderItems(providerQuery.data), [providerQuery.data]);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Array<{ provider: ProviderCatalogItem; modelId: string; name: string }> = [];
    for (const provider of catalog) {
      if (providerFilter !== "all" && provider.id !== providerFilter) continue;
      for (const modelId of Object.keys(provider.models)) {
        const name = provider.models[modelId]?.name ?? modelId;
        if (
          q &&
          !modelId.toLowerCase().includes(q) &&
          !name.toLowerCase().includes(q) &&
          !provider.name.toLowerCase().includes(q)
        ) {
          continue;
        }
        rows.push({ provider, modelId, name });
      }
    }
    return rows.sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.modelId.localeCompare(b.modelId));
  }, [catalog, providerFilter, query]);

  return (
    <div className="w-full max-w-3xl space-y-4">
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Model Catalog</SettingsPanelTitle>
          <SettingsPanelDescription>
            {rows.length} models across {catalog.length} providers.
          </SettingsPanelDescription>
        </SettingsPanelHeading>
        <SettingsPanelToolbar>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
            <Select
              value={providerFilter}
              onValueChange={(value) => {
                if (value) setProviderFilter(value);
              }}
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {catalog.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingsPanelToolbar>
      </SettingsPanel>

      <div className="overflow-hidden rounded-2xl border border-dls-border">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-dls-border bg-gray-2/50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Model</span>
          <span>Provider</span>
          <span>Status</span>
        </div>
        <div className="max-h-[60vh] divide-y divide-dls-border overflow-y-auto">
          {rows.map((row) => (
            <div
              key={`${row.provider.id}:${row.modelId}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2 hover:bg-dls-hover"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{row.name}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground/60">{row.modelId}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <ProviderIcon providerId={row.provider.id} providerName={row.provider.name} size={14} />
                <span className="text-xs text-muted-foreground">{row.provider.name}</span>
              </div>
              {row.provider.connected ? (
                <span className="rounded-full bg-green-3 px-2 py-0.5 text-[10px] font-medium text-green-11">
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-amber-3 px-2 py-0.5 text-[10px] font-medium text-amber-11">
                  Not connected
                </span>
              )}
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No models found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom models — persist via opencode config.update()              */
/* ------------------------------------------------------------------ */

type CustomModelDraft = {
  providerId: string;
  modelId: string;
  name: string;
  baseURL: string;
  apiKey: string;
  reasoning: boolean;
  temperature: string;
  toolCall: boolean;
};

function emptyDraft(): CustomModelDraft {
  return {
    providerId: "custom",
    modelId: "",
    name: "",
    baseURL: "",
    apiKey: "",
    reasoning: false,
    temperature: "1",
    toolCall: true,
  };
}

function CustomModelsTab({ opencodeClient }: AdminPageBodyProps) {
  const [draft, setDraft] = useState<CustomModelDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [loadedModels, setLoadedModels] = useState<Array<{ providerId: string; modelId: string; name: string }>>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadConfig = useCallback(async () => {
    try {
      const config = unwrap(await opencodeClient.config.get());
      const provider = (config as { provider?: Record<string, { models?: Record<string, { name?: string }> }> }).provider ?? {};
      const rows: Array<{ providerId: string; modelId: string; name: string }> = [];
      for (const [providerId, pcfg] of Object.entries(provider)) {
        for (const [modelId, mcfg] of Object.entries(pcfg.models ?? {})) {
          rows.push({ providerId, modelId, name: mcfg.name ?? modelId });
        }
      }
      setLoadedModels(rows);
      setDefaultModel((config as { model?: string }).model ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to read config");
    }
  }, [opencodeClient]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig, reloadKey]);

  const saveCustomModel = useCallback(async () => {
    if (!draft.providerId.trim() || !draft.modelId.trim()) {
      toast.error("Provider and model id are required.");
      return;
    }
    setSaving(true);
    try {
      const current = unwrap(await opencodeClient.config.get());
      const next = {
        ...current,
        provider: {
          ...(current as { provider?: Record<string, unknown> }).provider,
          [draft.providerId.trim()]: {
            ...((current as { provider?: Record<string, unknown> }).provider?.[draft.providerId.trim()] ?? {}),
            models: {
              ...(((current as { provider?: Record<string, unknown> }).provider?.[draft.providerId.trim()] as { models?: Record<string, unknown> } | undefined)?.models ?? {}),
              [draft.modelId.trim()]: {
                id: draft.modelId.trim(),
                name: draft.name.trim() || draft.modelId.trim(),
                reasoning: draft.reasoning,
                temperature: draft.temperature.trim() ? Number(draft.temperature.trim()) : undefined,
                tool_call: draft.toolCall,
              },
            },
          },
        },
      };
      if (draft.baseURL.trim() || draft.apiKey.trim()) {
        const pcfg = (next as { provider: Record<string, unknown> }).provider[draft.providerId.trim()] as { options?: Record<string, unknown> };
        next.provider[draft.providerId.trim()] = {
          ...(pcfg ?? {}),
          options: {
            ...(pcfg?.options ?? {}),
            ...(draft.baseURL.trim() ? { baseURL: draft.baseURL.trim() } : {}),
            ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
          },
        };
      }
      await opencodeClient.config.update({ config: next as Record<string, unknown> });
      setDraft(emptyDraft());
      setReloadKey((k) => k + 1);
      toast.success(`Model ${draft.providerId}/${draft.modelId} saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save model");
    } finally {
      setSaving(false);
    }
  }, [draft, opencodeClient]);

  const setDefault = useCallback(
    async (ref: ModelRef) => {
      if (!ref.providerID || !ref.modelID) return;
      try {
        const current = unwrap(await opencodeClient.config.get());
        await opencodeClient.config.update({
          config: { ...current, model: `${ref.providerID}/${ref.modelID}` },
        });
        setDefaultModel(`${ref.providerID}/${ref.modelID}`);
        toast.success(`Default model set to ${ref.providerID}/${ref.modelID}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to set default model");
      }
    },
    [opencodeClient],
  );

  const removeCustomModel = useCallback(
    async (providerId: string, modelId: string) => {
      try {
        const current = unwrap(await opencodeClient.config.get());
        const provider = { ...(current as { provider?: Record<string, unknown> }).provider };
        const pcfg = provider[providerId] as { models?: Record<string, unknown> } | undefined;
        if (!pcfg?.models?.[modelId]) return;
        const models = { ...pcfg.models };
        delete models[modelId];
        provider[providerId] = { ...pcfg, models };
        await opencodeClient.config.update({
          config: { ...current, provider } as Record<string, unknown>,
        });
        setReloadKey((k) => k + 1);
        toast.success(`Removed ${providerId}/${modelId}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove model");
      }
    },
    [opencodeClient],
  );

  const setDraftField = useCallback(<K extends keyof CustomModelDraft>(key: K, value: CustomModelDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Custom Models</SettingsPanelTitle>
          <SettingsPanelDescription>
            Define your own models (provider id + model id). Base URL / API key and capability flags are persisted to
            the workspace opencode config. Default model:{" "}
            <span className="font-mono text-muted-foreground">{defaultModel || "—"}</span>
          </SettingsPanelDescription>
        </SettingsPanelHeading>
      </SettingsPanel>

      {/* Saved custom models */}
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Saved custom models</SettingsPanelTitle>
          <SettingsPanelDescription>{loadedModels.length} configured via opencode config.</SettingsPanelDescription>
        </SettingsPanelHeading>
      </SettingsPanel>
      <div className="grid gap-2">
        {loadedModels.map((row) => (
          <div
            key={`${row.providerId}:${row.modelId}`}
            className="flex items-center gap-3 rounded-2xl border border-dls-border bg-card px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{row.name}</div>
              <div className="truncate font-mono text-[10px] text-muted-foreground/60">
                {row.providerId}/{row.modelId}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setDefault({ providerID: row.providerId, modelID: row.modelId })}
            >
              Set default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-10 hover:bg-red-2 hover:text-red-11"
              onClick={() => void removeCustomModel(row.providerId, row.modelId)}
            >
              Remove
            </Button>
          </div>
        ))}
        {loadedModels.length === 0 ? (
          <div className="rounded-2xl border border-dls-border px-4 py-6 text-center text-sm text-muted-foreground">
            No custom models yet.
          </div>
        ) : null}
      </div>

      {/* Add model form */}
      <SettingsPanel>
        <SettingsPanelHeading>
          <SettingsPanelTitle>Add custom model</SettingsPanelTitle>
          <SettingsPanelDescription>
            Use provider <span className="font-mono">custom</span> for an OpenAI-compatible endpoint, or an existing
            provider id to extend its model list.
          </SettingsPanelDescription>
        </SettingsPanelHeading>
      </SettingsPanel>
      <div className="grid gap-3 rounded-2xl border border-dls-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Provider ID</Label>
            <Input
              placeholder="custom"
              value={draft.providerId}
              onChange={(e) => setDraftField("providerId", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Model ID</Label>
            <Input
              placeholder="my-model"
              value={draft.modelId}
              onChange={(e) => setDraftField("modelId", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input
              placeholder="My Model"
              value={draft.name}
              onChange={(e) => setDraftField("name", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Base URL (optional)</Label>
            <Input
              placeholder="https://api.example.com/v1"
              value={draft.baseURL}
              onChange={(e) => setDraftField("baseURL", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>API key (optional)</Label>
            <Input
              type="password"
              placeholder="sk-…"
              value={draft.apiKey}
              onChange={(e) => setDraftField("apiKey", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Temperature</Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => setDraftField("temperature", e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ToggleRow
            label="Supports reasoning (model strength levels)"
            checked={draft.reasoning}
            onChange={(v) => setDraftField("reasoning", v)}
          />
          <ToggleRow
            label="Supports tool calls"
            checked={draft.toolCall}
            onChange={(v) => setDraftField("toolCall", v)}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(emptyDraft())}>
            Reset
          </Button>
          <Button onClick={() => void saveCustomModel()} disabled={saving}>
            {saving ? "Saving…" : "Save custom model"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        className="size-4 rounded border-dls-border accent-[var(--dls-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
