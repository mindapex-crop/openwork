/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Circle,
  FileText,
  Folder,
  Layers,
  ListTodo,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
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
import {
  createOpenworkServerClient,
  type OpenworkServerClient,
  type OpenworkSpaceData,
  type OpenworkSpacePlan,
  type OpenworkSpaceTask,
} from "@/app/lib/openwork-server";
import { cn } from "@/lib/utils";
import { isDesktopRuntime } from "@/app/utils";
import { t } from "@/i18n";
import { workspaceBootstrap, type WorkspaceInfo, type WorkspaceList } from "@/app/lib/desktop";
import { resolveOpenworkConnection } from "../../shell/openwork-connection";
import { useBootState } from "../../shell/boot-state";
import { readActiveWorkspaceId } from "../../shell/session-memory";
import { formatSessionRelativeTime } from "../session/sidebar/utils";
import { useNavigate } from "react-router-dom";
import type { Session } from "@opencode-ai/sdk/v2/client";

type SpaceTab = "activity" | "plans" | "tasks" | "assets" | "settings";

const SPACE_TABS: Array<{ id: SpaceTab; label: string; icon: typeof Activity }> = [
  { id: "activity", label: "动态", icon: Activity },
  { id: "plans", label: "计划", icon: Layers },
  { id: "tasks", label: "任务", icon: ListTodo },
  { id: "assets", label: "资产", icon: Folder },
  { id: "settings", label: "设置", icon: Settings2 },
];

const EMPTY_SPACE_DATA: OpenworkSpaceData = {
  settings: { name: "", description: "", skills: [], env: {} },
  plans: [],
  tasks: [],
};

const PLAN_STATUS_LABELS: Record<OpenworkSpacePlan["status"], string> = {
  backlog: "待办",
  active: "进行中",
  done: "已完成",
};

const TASK_STATUS_LABELS: Record<OpenworkSpaceTask["status"], string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
};

const PRIORITY_LABELS: Record<OpenworkSpaceTask["priority"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function mergeWorkspaceLists(server: WorkspaceInfo[], desktop: WorkspaceInfo[]): WorkspaceInfo[] {
  const byId = new Map<string, WorkspaceInfo>();
  for (const w of server) byId.set(w.id, w);
  for (const w of desktop) if (!byId.has(w.id)) byId.set(w.id, w);
  return Array.from(byId.values());
}

function resolveWorkspaceListSelected(list: WorkspaceList | null): string {
  if (!list) return "";
  return list.selectedId ?? list.activeId ?? "";
}

type SpaceRouteBodyProps = {
  openworkClient: OpenworkServerClient;
  workspaceId: string;
  tab: SpaceTab;
};

type SpaceTabItemProps = {
  openworkClient: OpenworkServerClient;
  workspaceId: string;
};

export function SpaceRoute() {
  const [tab, setTab] = useState<SpaceTab>("activity");
  const [openworkClient, setOpenworkClient] = useState<OpenworkServerClient | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { markRouteReady } = useBootState();

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
      const client = createOpenworkServerClient({ baseUrl: normalizedBaseUrl, token: resolvedToken });
      let serverWorkspaces: WorkspaceInfo[] = [];
      try {
        const list = await client.listWorkspaces();
        serverWorkspaces = list.items as unknown as WorkspaceInfo[];
      } catch {
        // Desktop-only mode: rely on the bootstrap list.
      }
      const merged = mergeWorkspaceLists(serverWorkspaces, desktopWorkspaces);
      setOpenworkClient(client);
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
      console.error("[space-route] connection failed", error);
      setWorkspaces(desktopWorkspaces);
    } finally {
      setLoading(false);
      // Space can be the first route a user lands on (direct link, deep
      // link, or after reload). Let the boot overlay dismiss once we've
      // completed our first data load so it never blocks interaction here.
      markRouteReady();
    }
  }, [markRouteReady]);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection, refreshKey]);

  const navigate = useNavigate();

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? workspaces[0] ?? null,
    [selectedWorkspaceId, workspaces],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Tab rail */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-dls-border bg-gray-2/30 p-2">
        <div className="flex items-center gap-2 px-2 pb-2 pt-1">
          <Boxes className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-dls-text">空间</span>
        </div>
        <nav className="flex flex-col gap-1">
          {SPACE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                tab === id ? "bg-gray-3 text-gray-12" : "text-gray-11 hover:bg-gray-2",
              )}
              onClick={() => setTab(id)}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 pb-2">
          <Button
            variant="outline"
            className="w-full gap-2 text-xs"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-dls-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-11 hover:bg-gray-3 hover:text-gray-12"
              onClick={() => navigate("/session")}
            >
              <ArrowLeft className="size-3.5" />
              {t("app.back_to_session")}
            </button>
            <span className="truncate text-sm font-medium text-dls-text">
              {SPACE_TABS.find((item) => item.id === tab)?.label}
            </span>
            {selectedWorkspace ? (
              <span className="truncate rounded-full bg-gray-3 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {selectedWorkspace.displayName ?? selectedWorkspace.name ?? selectedWorkspace.id}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {openworkClient ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-3 px-2.5 py-1 text-[11px] font-medium text-green-11">
                <span className="size-1.5 rounded-full bg-green-9" />
                服务器已连接
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
                <SelectValue placeholder="工作区" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id} className="text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {workspace.displayName ?? workspace.name ?? workspace.id}
                      </span>
                      {workspace.workspaceType === "remote" ? (
                        <span className="shrink-0 rounded bg-blue-3 px-1 text-[9px] text-blue-11">远程</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          {connectionError ? (
            <div className="flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-5/50 bg-red-2/40 px-6 py-8 text-center">
              <p className="text-sm text-red-11">{connectionError}</p>
              <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
                重试
              </Button>
            </div>
          ) : !openworkClient || !selectedWorkspace ? (
            <div className="text-sm text-muted-foreground">未选择工作区。</div>
          ) : (
            <SpaceRouteBody
              key={selectedWorkspace.id}
              openworkClient={openworkClient}
              workspaceId={selectedWorkspace.id}
              tab={tab}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SpaceRouteBody({ openworkClient, workspaceId, tab }: SpaceRouteBodyProps) {
  const [data, setData] = useState<OpenworkSpaceData>(EMPTY_SPACE_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: next } = await openworkClient.getSpace(workspaceId);
      setData(next ?? EMPTY_SPACE_DATA);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "空间数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [openworkClient, workspaceId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const save = useCallback(
    async (updater: (current: OpenworkSpaceData) => OpenworkSpaceData) => {
      setSaving(true);
      try {
        const { data: next } = await openworkClient.patchSpace(
          workspaceId,
          updater(data),
        );
        setData(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "空间数据保存失败");
      } finally {
        setSaving(false);
      }
    },
    [openworkClient, workspaceId, data],
  );

  if (loading) {
    return <SpaceSkeleton />;
  }

  const sharedToolbar = (
    <span className="text-xs text-muted-foreground">{saving ? "保存中…" : null}</span>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      {tab === "activity" && <ActivityTab workspaceId={workspaceId} openworkClient={openworkClient} />}
      {tab === "plans" && <PlansTab data={data} onSave={save} saving={saving} toolbarStatus={sharedToolbar} />}
      {tab === "tasks" && <TasksTab data={data} onSave={save} saving={saving} toolbarStatus={sharedToolbar} />}
      {tab === "assets" && <AssetsTab workspaceId={workspaceId} openworkClient={openworkClient} />}
      {tab === "settings" && <SettingsTab data={data} onSave={save} saving={saving} toolbarStatus={sharedToolbar} />}
    </div>
  );
}

/** WorkBuddy 风格骨架屏：标题栏 + 工具栏 + 表格行占位（pulse 动画）。 */
function SpaceSkeleton() {
  const rows = [0, 1, 2, 3, 4];
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded-md bg-gray-4" />
          <div className="h-3.5 w-52 animate-pulse rounded bg-gray-4/70" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 animate-pulse rounded-md bg-gray-4/70" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-gray-4/70" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-gray-4/70" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-dls-border">
        <div className="grid grid-cols-[12px_1fr_140px_120px_36px] gap-3 border-b border-dls-border bg-gray-2/50 px-4 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-gray-4/70" />
          ))}
        </div>
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-[12px_1fr_140px_120px_36px] items-center gap-3 px-4 py-2.5">
            <div className="size-2 animate-pulse rounded-full bg-gray-4/70" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-gray-4/70" />
            <div className="h-6 animate-pulse rounded-md bg-gray-4/60" />
            <div className="h-6 animate-pulse rounded-md bg-gray-4/60" />
            <div className="size-4 animate-pulse rounded bg-gray-4/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab({ workspaceId, openworkClient }: SpaceTabItemProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { items } = await openworkClient.listSessions(workspaceId, { roots: true, limit: 50 });
        if (!cancelled) setSessions(items ?? []);
      } catch {
        // Activity is best-effort.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, openworkClient]);

  const sorted = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const at = a.time?.updated ?? a.time?.created ?? 0;
        const bt = b.time?.updated ?? b.time?.created ?? 0;
        return bt - at;
      }),
    [sessions],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-dls-text">动态</h1>
          <p className="text-sm text-muted-foreground">此空间的最近动态。</p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? <span className="text-xs text-muted-foreground">加载中…</span> : null}
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dls-border p-6 text-center text-sm text-muted-foreground">
          {loading ? "正在加载会话…" : "此空间暂无会话。"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dls-border">
          <div className="grid grid-cols-[1fr_120px] items-center gap-3 border-b border-dls-border bg-gray-2/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>会话</span>
            <span className="text-right">更新时间</span>
          </div>
          {sorted.map((session, index) => {
            const updatedAt = session.time?.updated ?? session.time?.created;
            return (
              <div
                key={session.id}
                className={cn(
                  "grid grid-cols-[1fr_120px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-2/40",
                  index > 0 && "border-t border-dls-border",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-gray-5" />
                  <span className="truncate text-sm text-gray-11">{session.title || "未命名会话"}</span>
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  {formatSessionRelativeTime(updatedAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlansTab({ data, onSave, saving, toolbarStatus }: TabProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetail, setDraftDetail] = useState("");

  const addPlan = () => {
    const title = draftTitle.trim();
    if (!title) return;
    const plan: OpenworkSpacePlan = {
      id: `plan_${Date.now().toString(36)}`,
      title,
      detail: draftDetail.trim(),
      status: "backlog",
      updatedAt: Date.now(),
    };
    void onSave((current) => ({ ...current, plans: [plan, ...current.plans] }));
    setDraftTitle("");
    setDraftDetail("");
  };

  const updatePlan = (id: string, patch: Partial<Pick<OpenworkSpacePlan, "status" | "title" | "detail">>) => {
    void onSave((current) => ({
      ...current,
      plans: current.plans.map((plan) =>
        plan.id === id ? { ...plan, ...patch, updatedAt: Date.now() } : plan,
      ),
    }));
  };

  const removePlan = (id: string) => {
    void onSave((current) => ({ ...current, plans: current.plans.filter((plan) => plan.id !== id) }));
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-dls-text">计划</h1>
          <p className="text-sm text-muted-foreground">此空间的计划。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarStatus}
          <Input
            placeholder="计划标题…"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="h-8 w-56"
          />
          <Input
            placeholder="详情（可选）…"
            value={draftDetail}
            onChange={(e) => setDraftDetail(e.target.value)}
            className="h-8 w-64 min-w-40"
          />
          <Button size="sm" onClick={addPlan} disabled={!draftTitle.trim() || saving}>
            <Plus className="size-3.5" />
            添加
          </Button>
        </div>
      </div>
      {data.plans.length === 0 ? (
        <div className="rounded-xl border border-dls-border p-6 text-center text-sm text-muted-foreground">暂无计划。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dls-border">
          <div className="grid grid-cols-[12px_1fr_140px_36px] items-center gap-3 border-b border-dls-border bg-gray-2/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span />
            <span>计划</span>
            <span>状态</span>
            <span />
          </div>
          {data.plans.map((plan, index) => (
            <div
              key={plan.id}
              className={cn(
                "grid grid-cols-[12px_1fr_140px_36px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-2/40",
                index > 0 && "border-t border-dls-border",
              )}
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  plan.status === "done" ? "bg-green-9" : plan.status === "active" ? "bg-blue-9" : "bg-gray-5",
                )}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-11">{plan.title}</div>
                {plan.detail ? (
                  <div className="truncate text-xs text-muted-foreground">{plan.detail}</div>
                ) : null}
              </div>
              <Select
                value={plan.status}
                onValueChange={(value) => {
                  if (value === "backlog" || value === "active" || value === "done") updatePlan(plan.id, { status: value });
                }}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue>{PLAN_STATUS_LABELS[plan.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">{PLAN_STATUS_LABELS.backlog}</SelectItem>
                  <SelectItem value="active">{PLAN_STATUS_LABELS.active}</SelectItem>
                  <SelectItem value="done">{PLAN_STATUS_LABELS.done}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => removePlan(plan.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TasksTab({ data, onSave, saving, toolbarStatus }: TabProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState<OpenworkSpaceTask["priority"]>("medium");

  const addTask = () => {
    const title = draftTitle.trim();
    if (!title) return;
    const task: OpenworkSpaceTask = {
      id: `task_${Date.now().toString(36)}`,
      title,
      status: "todo",
      priority: draftPriority,
      updatedAt: Date.now(),
    };
    void onSave((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    setDraftTitle("");
  };

  const updateTask = (id: string, patch: Partial<Pick<OpenworkSpaceTask, "status" | "priority" | "title">>) => {
    void onSave((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, ...patch, updatedAt: Date.now() } : task,
      ),
    }));
  };

  const removeTask = (id: string) => {
    void onSave((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-dls-text">任务</h1>
          <p className="text-sm text-muted-foreground">此空间的任务看板。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarStatus}
          <Select
            value={draftPriority}
            onValueChange={(value) => {
              if (value === "low" || value === "medium" || value === "high") setDraftPriority(value);
            }}
          >
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue>{PRIORITY_LABELS[draftPriority]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
              <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
              <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="任务标题…"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="h-8 w-56"
          />
          <Button size="sm" onClick={addTask} disabled={!draftTitle.trim() || saving}>
            <Plus className="size-3.5" />
            添加
          </Button>
        </div>
      </div>
      {data.tasks.length === 0 ? (
        <div className="rounded-xl border border-dls-border p-6 text-center text-sm text-muted-foreground">暂无任务。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dls-border">
          <div className="grid grid-cols-[20px_1fr_110px_110px_36px] items-center gap-3 border-b border-dls-border bg-gray-2/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span />
            <span>任务</span>
            <span>状态</span>
            <span>优先级</span>
            <span />
          </div>
          {data.tasks.map((task, index) => (
            <div
              key={task.id}
              className={cn(
                "grid grid-cols-[20px_1fr_110px_110px_36px] items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-2/40",
                index > 0 && "border-t border-dls-border",
              )}
            >
              <button
                type="button"
                onClick={() => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}
                className="shrink-0 text-gray-9 transition-colors hover:text-green-11"
              >
                {task.status === "done" ? <CheckCircle2 className="size-4 text-green-9" /> : <Circle className="size-4" />}
              </button>
              <span className={cn("min-w-0 truncate text-sm", task.status === "done" ? "text-muted-foreground line-through" : "text-gray-11")}>
                {task.title}
              </span>
              <Select
                value={task.status}
                onValueChange={(value) => {
                  if (value === "todo" || value === "doing" || value === "done") updateTask(task.id, { status: value });
                }}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue>{TASK_STATUS_LABELS[task.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{TASK_STATUS_LABELS.todo}</SelectItem>
                  <SelectItem value="doing">{TASK_STATUS_LABELS.doing}</SelectItem>
                  <SelectItem value="done">{TASK_STATUS_LABELS.done}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={task.priority}
                onValueChange={(value) => {
                  if (value === "low" || value === "medium" || value === "high") updateTask(task.id, { priority: value });
                }}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue>{PRIORITY_LABELS[task.priority]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
                  <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
                  <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => removeTask(task.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetsTab({ workspaceId, openworkClient }: SpaceTabItemProps) {
  const [assets, setAssets] = useState<Array<{ path: string; kind: "file" | "dir"; size: number; mtimeMs: number; depth: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { items } = await openworkClient.listSpaceAssets(workspaceId);
        if (!cancelled) setAssets(items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "资产加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, openworkClient]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-dls-text">资产</h1>
          <p className="text-sm text-muted-foreground">此空间的文件（不含 .opencode）。</p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? <span className="text-xs text-muted-foreground">加载中…</span> : null}
        </div>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-5/50 bg-red-2/40 p-6 text-center text-sm text-red-11">{error}</div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dls-border p-6 text-center text-sm text-muted-foreground">
          {loading ? "正在加载资产…" : "未找到资产。"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dls-border">
          <div className="grid grid-cols-[1fr_90px] items-center gap-3 border-b border-dls-border bg-gray-2/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>文件</span>
            <span className="text-right">大小</span>
          </div>
          {assets.map((asset, index) => (
            <div
              key={asset.path}
              className={cn(
                "grid grid-cols-[1fr_90px] items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-2/40",
                index > 0 && "border-t border-dls-border",
              )}
              style={{ paddingLeft: 16 + asset.depth * 16 }}
            >
              <span className="flex min-w-0 items-center gap-2">
                {asset.kind === "dir" ? (
                  <Folder className="size-4 shrink-0 text-amber-10" />
                ) : (
                  <FileText className="size-4 shrink-0 text-gray-9" />
                )}
                <span className="truncate font-mono text-xs text-gray-11">{asset.path}</span>
              </span>
              {asset.kind === "file" ? (
                <span className="text-right text-xs text-muted-foreground">{formatBytes(asset.size)}</span>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TabProps = {
  data: OpenworkSpaceData;
  onSave: (updater: (current: OpenworkSpaceData) => OpenworkSpaceData) => Promise<void>;
  saving: boolean;
  toolbarStatus: React.ReactNode;
};

function SettingsTab({ data, onSave, saving, toolbarStatus }: TabProps) {
  const [name, setName] = useState(data.settings.name);
  const [description, setDescription] = useState(data.settings.description);
  const [skillsText, setSkillsText] = useState(data.settings.skills.join(", "));
  const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(data.settings.env).map(([key, value]) => ({ key, value })),
  );

  const saveSettings = () => {
    const env: Record<string, string> = {};
    for (const { key, value } of envEntries) {
      const trimmedKey = key.trim();
      if (trimmedKey) env[trimmedKey] = value;
    }
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    void onSave((current) => ({
      ...current,
      settings: { name: name.trim(), description: description.trim(), skills, env },
    }));
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-dls-text">设置</h1>
          <p className="text-sm text-muted-foreground">空间名称、技能与环境变量。</p>
        </div>
        <div className="flex items-center gap-2">
          {toolbarStatus}
          <Button variant="outline" size="sm" onClick={saveSettings} disabled={saving}>
            保存
          </Button>
        </div>
      </div>
      <div className="max-w-2xl space-y-5 rounded-xl border border-dls-border p-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-11">空间名称</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="空间名称" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-11">描述</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="空间描述" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-11">技能（逗号分隔）</label>
          <Input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="skill-a, skill-b" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-11">环境变量</label>
          <div className="grid gap-2">
            {envEntries.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={entry.key}
                  onChange={(e) => {
                    const next = [...envEntries];
                    next[index] = { ...next[index], key: e.target.value };
                    setEnvEntries(next);
                  }}
                  placeholder="KEY"
                  className="h-8 w-56 font-mono text-xs"
                />
                <Input
                  value={entry.value}
                  onChange={(e) => {
                    const next = [...envEntries];
                    next[index] = { ...next[index], value: e.target.value };
                    setEnvEntries(next);
                  }}
                  placeholder="value"
                  className="h-8 flex-1 font-mono text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEnvEntries(envEntries.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setEnvEntries([...envEntries, { key: "", value: "" }])}
            >
              <Plus className="size-3.5" />
              添加变量
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
