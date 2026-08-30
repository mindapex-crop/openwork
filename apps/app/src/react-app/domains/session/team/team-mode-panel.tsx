/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cpu,
  Gauge,
  GitBranch,
  Network,
  Plus,
  Play,
  RefreshCw,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useExpertsStore } from "../../experts/experts-store";
import type { Expert } from "../../experts/types";
import {
  type DecompositionResult,
  type HarnessInfo,
  type HarnessKind,
  type MemberRole,
  type StrategyInfo,
  type TaskSnapshot,
  type TeamDetail,
  type TeamRunResult,
  type TeamStrategyId,
  type TeamSummary,
  teamApiRequest,
} from "./team-api";

type TeamPanelProps = {
  onClose: () => void;
};

type CreateTeamState = {
  name: string;
  strategy: TeamStrategyId;
  harnessId: string;
  members: Array<{ agentId: string; role: MemberRole }>;
};

const ROLE_OPTIONS: MemberRole[] = ["primary", "specialist", "reviewer", "fallback", "observer"];

/** 执行期间子任务进度的轮询间隔：run 响应要等整个 fan-out 结束，进度靠落盘快照轮询 */
const TASK_POLL_INTERVAL_MS = 1_500;

const ROLE_LABELS: Record<MemberRole, string> = {
  primary: "Primary",
  specialist: "Specialist",
  reviewer: "Reviewer",
  fallback: "Fallback",
  observer: "Observer",
};

const STRATEGY_META: Record<TeamStrategyId, { color: string; icon: typeof Gauge; badge: string }> = {
  conservative: { color: "text-emerald-500", icon: Gauge, badge: "bg-emerald-500/10 text-emerald-600" },
  balanced: { color: "text-amber-500", icon: Gauge, badge: "bg-amber-500/10 text-amber-600" },
  aggressive: { color: "text-violet-500", icon: Rocket, badge: "bg-violet-500/10 text-violet-600" },
};

const HARNESS_ICONS: Record<HarnessKind, typeof Server> = {
  local: Server,
  ssh: Network,
  cloud: Cloud,
  container: Cpu,
};

function getStatusColor(status: string) {
  switch (status) {
    case "idle":
      return "bg-gray-500/10 text-gray-500";
    case "running":
      return "bg-sky-500/10 text-sky-500 animate-pulse";
    case "completed":
      return "bg-emerald-500/10 text-emerald-600";
    case "failed":
      return "bg-red-500/10 text-red-600";
    default:
      return "bg-gray-500/10 text-gray-500";
  }
}

// ---------- Main Panel ----------

export function TeamPanel(props: TeamPanelProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [harnesses, setHarnesses] = useState<HarnessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [decompositionResult, setDecompositionResult] = useState<DecompositionResult | null>(null);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [runningTeamId, setRunningTeamId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<TeamRunResult | null>(null);
  const [liveTask, setLiveTask] = useState<TaskSnapshot | null>(null);
  const isRunning = runningTeamId !== null;
  const executionCardRef = useRef<HTMLDivElement>(null);

  // 本地专家列表：成员编辑可复用专家选择；后端未就绪时静默失败，回退自由输入。
  const experts = useExpertsStore((state) => state.experts);

  useEffect(() => {
    void useExpertsStore.getState().fetchExperts().catch(() => {});
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );

  // 执行卡的数据源：运行中用轮询到的快照，否则回落到团队持久化的上一次任务结果。
  const taskView = liveTask ?? teamDetail?.lastTaskResult ?? null;
  const subtaskRows = taskView?.subtasks ?? [];
  const finishedSubtasks = subtaskRows.filter(
    (row) => row.status === "completed" || row.status === "failed",
  ).length;

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [teamsData, strategiesData, harnessesData] = await Promise.all([
        teamApiRequest<{ teams: TeamSummary[] }>("/teams"),
        teamApiRequest<{ strategies: StrategyInfo[] }>("/team-strategies"),
        teamApiRequest<{ harnesses: HarnessInfo[] }>("/team-harnesses"),
      ]);
      setTeams(teamsData.teams);
      setStrategies(strategiesData.strategies);
      setHarnesses(harnessesData.harnesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeamDetail = useCallback(async (teamId: string) => {
    try {
      const data = await teamApiRequest<{ team: TeamDetail }>(`/teams/${teamId}`);
      setTeamDetail(data.team);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setLiveTask(null);
    setRunResult(null);
    if (selectedTeamId) {
      void loadTeamDetail(selectedTeamId);
    } else {
      setTeamDetail(null);
    }
  }, [selectedTeamId, loadTeamDetail]);

  // 执行期间轮询落盘快照：POST /run 要等整个 fan-out 结束才返回，进度只能这样看到。
  useEffect(() => {
    if (!runningTeamId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await teamApiRequest<{ tasks: TaskSnapshot[] }>(`/teams/${runningTeamId}/tasks`);
        if (!cancelled) setLiveTask(data.tasks[0] ?? null);
      } catch {
        // 单次轮询失败忽略：终态由 run 响应写入
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), TASK_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runningTeamId]);

  // 运行一开始就把执行卡滚进可视区：它渲染在任务框下方，不滚的话用户看不到进度。
  useEffect(() => {
    if (!runningTeamId) return;
    executionCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [runningTeamId]);

  const handleCreateTeam = useCallback(async (state: CreateTeamState) => {
    try {
      const data = await teamApiRequest<{ team: TeamDetail }>("/teams", {
        method: "POST",
        body: JSON.stringify({
          name: state.name,
          strategy: state.strategy,
          harnessId: state.harnessId,
          members: state.members,
        }),
      });
      setTeams((prev) => [...prev, {
        id: data.team.id,
        name: data.team.name,
        strategy: data.team.strategy,
        memberCount: data.team.memberSpecs.length,
        harnessId: data.team.harnessId,
        status: data.team.status,
        createdAt: data.team.createdAt,
        updatedAt: data.team.updatedAt,
      }]);
      setSelectedTeamId(data.team.id);
      setShowCreateDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleDecompose = useCallback(async () => {
    if (!selectedTeamId || !taskPrompt.trim()) return;
    setDecomposing(true);
    setDecompositionResult(null);
    setError(null);
    try {
      const data = await teamApiRequest<{ decomposition: DecompositionResult }>(
        `/teams/${selectedTeamId}/decompose`,
        {
          method: "POST",
          body: JSON.stringify({ taskPrompt }),
        },
      );
      setDecompositionResult(data.decomposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDecomposing(false);
    }
  }, [selectedTeamId, taskPrompt]);

  const handleRunTask = useCallback(async () => {
    if (!selectedTeamId || !taskPrompt.trim()) return;
    setRunningTeamId(selectedTeamId);
    setRunResult(null);
    setLiveTask(null);
    setError(null);
    try {
      const result = await teamApiRequest<TeamRunResult>(`/teams/${selectedTeamId}/run`, {
        method: "POST",
        body: JSON.stringify({ taskPrompt }),
      });
      setRunResult(result);
      setLiveTask({ taskId: result.taskId, subtasks: result.subtaskResults, completedAt: Date.now() });
      void loadData();
      void loadTeamDetail(selectedTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningTeamId(null);
    }
  }, [selectedTeamId, taskPrompt, loadData, loadTeamDetail]);

  const handleDeleteTeam = useCallback(async (teamId: string) => {
    try {
      await teamApiRequest(`/teams/${teamId}`, { method: "DELETE" });
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedTeamId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold">Team Mode</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={loadData} title="Refresh" disabled={loading}>
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onClose} title="Close">
            <X size={14} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-4 p-4">
            {/* Strategy Cards */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} />
                  <span className="text-sm font-medium">Strategy Presets</span>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger>
                    <Button size="sm" variant="outline">
                      <Plus size={14} className="mr-1" />
                      Create Team
                    </Button>
                  </DialogTrigger>
                  <CreateTeamDialog
                    strategies={strategies}
                    harnesses={harnesses}
                    experts={experts}
                    onSubmit={handleCreateTeam}
                    onCancel={() => setShowCreateDialog(false)}
                  />
                </Dialog>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {strategies.map((s) => {
                  const meta = STRATEGY_META[s.id];
                  const Icon = meta.icon;
                  return (
                    <Card key={s.id} variant="outline" size="sm" className="cursor-pointer transition-all hover:border-primary/40">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={meta.color} />
                          <span className="text-sm font-medium">{s.name}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        <div className="mt-2 flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {s.complexity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            max {s.maxSubtasks} subtasks
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Team List */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Bot size={14} />
                <span className="text-sm font-medium">Teams</span>
                <span className="text-xs text-muted-foreground">({teams.length})</span>
              </div>
              {teams.length === 0 && !loading ? (
                <Card variant="outline" size="sm">
                  <CardContent className="p-6 text-center">
                    <Users size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No teams yet. Create one to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <Card
                      key={team.id}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedTeamId === team.id ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
                      )}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("rounded-md p-2", STRATEGY_META[team.strategy].badge)}>
                            <Users size={14} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{team.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {team.strategy}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{team.memberCount} members</span>
                              <span>&middot;</span>
                              <span>{team.harnessId}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px]", getStatusColor(team.status))}>
                            {team.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteTeam(team.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Team Detail & Task Runner */}
            {selectedTeam && teamDetail ? (
              <div className="space-y-3">
                <Card variant="outline" size="sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GitBranch size={14} />
                        {selectedTeam.name}
                      </CardTitle>
                      <Badge variant="outline" className={getStatusColor(teamDetail.status)}>
                        {teamDetail.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      Strategy: {teamDetail.strategy} &middot; Harness: {teamDetail.harnessId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Members ({teamDetail.memberSpecs.length})</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {teamDetail.memberSpecs.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Bot size={10} className="mr-1" />
                            {m.agentId}
                            {m.role ? ` (${m.role})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Task Prompt</Label>
                      <Textarea
                        placeholder="Describe the task you want the team to execute..."
                        value={taskPrompt}
                        onChange={(e) => setTaskPrompt(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleDecompose()}
                          disabled={!taskPrompt.trim() || decomposing}
                        >
                          <Sparkles size={14} className="mr-1" />
                          {decomposing ? "Decomposing..." : "Analyze & Decompose"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleRunTask()}
                          disabled={!taskPrompt.trim() || isRunning}
                        >
                          <Play size={14} className="mr-1" />
                          {isRunning ? "Running..." : "Run Team Task"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Decomposition Result */}
                {decompositionResult ? (
                  <Card variant="outline" size="sm" className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap size={14} className="text-primary" />
                        Task Decomposition
                      </CardTitle>
                      <CardDescription>
                        Complexity: {decompositionResult.complexity} &middot; Strategy: {decompositionResult.strategy}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {decompositionResult.subtasks.length} subtasks across {teamDetail.memberSpecs.length} members
                        </span>
                        <span>&middot;</span>
                        <span>
                          cost: {decompositionResult.strategyMeta.costLevel} &middot; quality:{" "}
                          {decompositionResult.strategyMeta.qualityLevel}
                        </span>
                        <span>&middot;</span>
                        <span>Approach: {decompositionResult.suggestedApproach}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Fan-out multiplies token use — one measured 5-subtask run cost about 5.6× a single-agent
                        run. Indicative only, not a quote for this task.
                      </p>
                      <div className="space-y-1">
                        {decompositionResult.subtasks.map((st, i) => (
                          <div
                            key={st.subtaskId}
                            className="rounded-md border border-border bg-muted/50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Step {i + 1}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {st.agentId}
                              </Badge>
                              {st.dependencies.length > 0 ? (
                                <span className="text-[10px] text-muted-foreground">
                                  depends on: {st.dependencies.join(", ")}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{st.prompt}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {/* 子任务实时流：运行中轮询服务端落盘快照，结束后由 run 响应补全终态 */}
                {isRunning || taskView ? (
                  <Card
                    ref={executionCardRef}
                    variant="outline"
                    size="sm"
                    className={isRunning ? "border-sky-500/30" : "border-emerald-200"}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Rocket size={14} className="text-emerald-500" />
                          Subtask Execution
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {finishedSubtasks}/{subtaskRows.length} finished
                        </span>
                      </div>
                      <CardDescription>
                        {runResult?.message ??
                          (isRunning
                            ? liveTask
                              ? `Progress refreshes every ${TASK_POLL_INTERVAL_MS / 1000}s.`
                              : "Waiting for the first progress snapshot…"
                            : "")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {subtaskRows.map((st, i) => {
                          const role = teamDetail?.memberSpecs.find((m) => m.agentId === st.agentId)?.role;
                          return (
                            <div
                              key={st.subtaskId}
                              className="flex items-start gap-2 rounded-md border border-border px-3 py-2"
                            >
                              <span className="mt-0.5 text-xs font-medium">{i + 1}.</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">
                                    <Bot size={10} className="mr-1" />
                                    {st.agentId}
                                  </Badge>
                                  {role ? (
                                    <Badge variant="outline" className="text-[10px]">
                                      {role}
                                    </Badge>
                                  ) : null}
                                  <Badge variant="outline" className={cn("text-[10px]", getStatusColor(st.status))}>
                                    {st.status}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{st.prompt}</p>
                                {st.outputTail ? (
                                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                    {st.outputTail}
                                  </pre>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {/* Harness List */}
            {harnesses.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Server size={14} />
                  <span className="text-sm font-medium">Harness Environments</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {harnesses.map((h) => {
                    const Icon = HARNESS_ICONS[h.kind];
                    return (
                      <Card key={h.id} variant="outline" size="sm">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-muted-foreground" />
                            <span className="text-sm font-medium">{h.name}</span>
                            {h.health ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  h.health.status === "healthy"
                                    ? "text-emerald-600"
                                    : h.health.status === "degraded"
                                    ? "text-amber-600"
                                    : "text-red-600",
                                )}
                              >
                                {h.health.status}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {h.capabilities.maxConcurrentAgents} concurrent agents &middot; {h.kind}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}

// ---------- Create Team Dialog ----------

type CreateTeamDialogProps = {
  strategies: StrategyInfo[];
  harnesses: HarnessInfo[];
  /** 可复用的本地专家列表（为空时回退自由输入 Agent ID）。 */
  experts: readonly Expert[];
  onSubmit: (state: CreateTeamState) => Promise<void>;
  onCancel: () => void;
};

function CreateTeamDialog(props: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<TeamStrategyId>("balanced");
  const [harnessId, setHarnessId] = useState("local-default");
  const [members, setMembers] = useState<Array<{ agentId: string; role: MemberRole }>>([
    { agentId: "", role: "primary" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = useCallback(() => {
    setMembers((prev) => [...prev, { agentId: "", role: "specialist" }]);
  }, []);

  const removeMember = useCallback((index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMember = useCallback((index: number, field: "agentId" | "role", value: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    const validMembers = members.filter((m) => m.agentId.trim());
    if (validMembers.length === 0) {
      setError("At least one team member is required");
      return;
    }
    setSubmitting(true);
    try {
      await props.onSubmit({
        name: name.trim(),
        strategy,
        harnessId,
        members: validMembers,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [name, members, strategy, harnessId, props]);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Create Team</DialogTitle>
        <DialogDescription>
          Configure a team of AI agents to work together on complex tasks.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Team Name</Label>
          <Input
            placeholder="e.g., Backend Feature Team"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <Tabs value={strategy} onValueChange={(v) => setStrategy(v as TeamStrategyId)}>
          <TabsList className="grid w-full grid-cols-3">
            {props.strategies.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {props.strategies.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-2">
              <Card variant="outline" size="sm">
                <CardContent className="p-3">
                  <p className="text-sm">{s.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Complexity: {s.complexity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Max {s.maxSubtasks} subtasks
                    </Badge>
                    {s.enableReviewLoop ? (
                      <Badge variant="outline" className="text-[10px]">
                        Review loop
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="space-y-2">
          <Label>Harness Environment</Label>
          <Select value={harnessId} onValueChange={(v: string | null) => setHarnessId(v ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.harnesses.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name} ({h.kind})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Team Members</Label>
            <Button variant="outline" size="sm" onClick={addMember}>
              <Plus size={12} className="mr-1" />
              Add Member
            </Button>
          </div>
          <div className="space-y-2">
            {members.map((member, i) => (
              <div key={i} className="flex items-center gap-2">
                {props.experts.length > 0 ? (
                  <Select
                    value={member.agentId}
                    onValueChange={(v: string | null) => updateMember(i, "agentId", v ?? "")}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select expert" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.experts.map((expert) => (
                        <SelectItem key={expert.id} value={expert.id}>
                          {expert.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Agent ID (e.g., opencode, kimi, deepscode)"
                    value={member.agentId}
                    onChange={(e) => updateMember(i, "agentId", e.target.value)}
                    className="flex-1"
                  />
                )}
                <Select value={member.role} onValueChange={(v: string | null) => updateMember(i, "role", v ?? "")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMember(i)}
                  disabled={members.length <= 1}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? "Creating..." : "Create Team"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

