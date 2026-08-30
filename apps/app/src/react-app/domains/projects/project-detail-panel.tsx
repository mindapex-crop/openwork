/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Boxes,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  LayoutList,
  Link2,
  ListChecks,
  MessagesSquare,
  Package,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { IM_CONNECTOR_DEFINITIONS, useImConnectorStore } from "@/react-app/domains/settings/im-connector-store";
import { DeviceSyncBadge } from "@/react-app/domains/devices/device-sync-badge";
import { SessionSurface, type SessionSurfaceProps } from "@/react-app/domains/session/surface/session-surface";
import { WorkspaceFilesPanel } from "@/react-app/domains/session/panel/workspace-files-panel";
import { useComposerStateStore } from "@/react-app/domains/session/surface/composer-state-store";
import { markComposerAutoSend } from "@/react-app/domains/session/surface/composer-auto-send";
import { groupTasksByStatus, planTaskProgress } from "./project-tasks-group";

import {
  PROJECT_WORK_COLUMNS,
  useProject,
  useProjectStore,
  useProjects,
} from "./project-store";
import type { Evidence, EvidenceStatus, Plan, PlanStatus, Project, Task, TaskStatus } from "./project-store";
import { parseProjectCommand } from "./project-commands";

type ProjectDetailPanelProps = {
  projectId: string;
  onClose?: () => void;
  onBack?: () => void;
  workspaceId?: string | null;
  workspaceRoot?: string;
  canCreateTask?: boolean;
  client?: import("@/app/lib/openwork-server").OpenworkServerClient | null;
  getThreadSurface?: (threadId: string) => SessionSurfaceProps | null;
  createThread?: () => Promise<string | null>;
};

const TASK_COLUMN_META: Record<TaskStatus, { key: string; dot: string }> = {
  todo: { key: "projects.col_todo", dot: "bg-muted-foreground" },
  in_progress: { key: "projects.col_in_progress", dot: "bg-sky-500" },
  review: { key: "projects.col_review", dot: "bg-amber-500" },
  done: { key: "projects.col_done", dot: "bg-emerald-500" },
};

const EVIDENCE_META: Record<EvidenceStatus, { key: string; className: string }> = {
  pending: { key: "projects.evidence_pending", className: "bg-muted text-muted-foreground" },
  passed: { key: "projects.evidence_passed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { key: "projects.evidence_failed", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ProjectTab = "tasks" | "activity" | "plans" | "assets";

type ActivityCategory = "all" | "mine" | "member" | "automation";

type ActivityEvent = {
  date: string;
  textKey: string;
  title: string;
  category: ActivityCategory;
};

type ProjectMember = {
  id: string;
  name: string;
  role: "owner" | "member";
  joinedAt: string;
};

type InviteStatus = "pending" | "approved" | "rejected";

type InviteRecord = {
  id: string;
  link: string;
  status: InviteStatus;
  createdAt: string;
};

type TaskCardProps = {
  task: Task;
  planId: string;
  projectId: string;
  projectPlans: Plan[];
  onStatusChange: (status: TaskStatus) => void;
  onEvidenceChange: (evidence: Evidence) => void;
  onMove: (toPlanId: string) => void;
  onRemove: () => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onRemoveSubtask: (subtaskId: string) => void;
  onAssigneeChange: (assignee: string) => void;
  onDragStart: () => void;
};

function TaskCard({
  task,
  planId,
  projectId,
  projectPlans,
  onStatusChange,
  onEvidenceChange,
  onMove,
  onRemove,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
  onAssigneeChange,
  onDragStart,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(task.evidence.notes);
  const [newSubtask, setNewSubtask] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);

  const allProjects = useProjects();
  const transferTask = useProjectStore((state) => state.transferTask);
  const packageTaskForTransfer = useProjectStore((state) => state.packageTaskForTransfer);

  const otherProjects = allProjects.filter((p) => p.id !== projectId);

  const handlePackageAndTransfer = () => {
    if (!transferTarget) return;
    const targetProject = allProjects.find((p) => p.id === transferTarget);
    if (!targetProject || targetProject.plans.length === 0) return;
    const targetPlan = targetProject.plans[0];
    const pkg = packageTaskForTransfer(projectId, planId, task.id);
    if (pkg) {
      const success = transferTask(projectId, planId, task.id, transferTarget, targetPlan.id);
      if (success) {
        setTransferSuccess(true);
        setShowTransfer(false);
        setTransferTarget("");
        setTimeout(() => setTransferSuccess(false), 3000);
      }
    }
  };

  const submitEvidence = (status: EvidenceStatus) => {
    onEvidenceChange({
      status,
      notes,
      ...(status === "passed" && !task.evidence.approvedAt
        ? { approvedAt: new Date().toISOString() }
        : {}),
    });
    setExpanded(false);
  };

  const otherPlans = projectPlans.filter((plan) => plan.id !== planId);
  const doneSubtaskCount = task.subtasks.filter((subtask) => subtask.done).length;

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    onAddSubtask(title);
    setNewSubtask("");
  };

  return (
    <Card
      variant="outline"
      size="sm"
      draggable
      onDragStart={onDragStart}
      className="cursor-grab gap-2 active:cursor-grabbing"
    >
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TASK_COLUMN_META[task.status].dot)} />
            <span className="text-sm font-medium">{task.title}</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            title={t("projects.remove_task")}
            aria-label={t("projects.remove_task")}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>

        <Select value={task.status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_WORK_COLUMNS.map((status) => (
              <SelectItem key={status} value={status}>
                {t(TASK_COLUMN_META[status].key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assignee — WorkBuddy agent collaboration */}
        <input
          value={task.assignee ?? ""}
          onChange={(event) => onAssigneeChange(event.target.value)}
          placeholder={t("projects.assignee_placeholder")}
          className="h-7 w-full rounded-lg border border-border bg-input/50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />

        {/* Subtasks — WorkBuddy task decomposition */}
        {task.subtasks.length > 0 ? (
          <div className="space-y-1">
            {task.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onToggleSubtask(subtask.id)}
                  aria-label={t("projects.toggle_subtask")}
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    subtask.done ? "border-emerald-500 bg-emerald-500/20" : "border-border",
                  )}
                >
                  {subtask.done ? <CheckCircle2 size={10} className="text-emerald-500" /> : null}
                </button>
                <span className={cn("min-w-0 flex-1", subtask.done && "text-muted-foreground line-through")}>
                  {subtask.title}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSubtask(subtask.id)}
                  title={t("projects.remove_subtask")}
                  aria-label={t("projects.remove_subtask")}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <input
            value={newSubtask}
            onChange={(event) => setNewSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            placeholder={t("projects.add_subtask")}
            className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button size="icon-sm" variant="outline" onClick={addSubtask} disabled={newSubtask.trim().length === 0} title={t("projects.add_subtask")} aria-label={t("projects.add_subtask")}>
            <Plus size={12} />
          </Button>
        </div>
        {task.subtasks.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("projects.subtasks_done", { done: doneSubtaskCount, total: task.subtasks.length })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setExpanded((current) => !current);
            setNotes(task.evidence.notes);
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ClipboardCheck size={12} />
            {t("projects.evidence")}
          </span>
          <Badge className={cn(EVIDENCE_META[task.evidence.status].className)}>
            {t(EVIDENCE_META[task.evidence.status].key)}
          </Badge>
        </button>

        {expanded ? (
          <div className="space-y-2 border-t border-border pt-2">
            {/* Evidence is ambient and flightless: only a verdict + notes. */}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("projects.evidence_notes_placeholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-input/50 px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["pending", "passed", "failed"] as EvidenceStatus[]).map((status) => (
                <Button
                  key={status}
                  size="xs"
                  variant={task.evidence.status === status ? "default" : "outline"}
                  onClick={() => submitEvidence(status)}
                >
                  {t(EVIDENCE_META[status].key)}
                </Button>
              ))}
            </div>
            {task.evidence.approvedAt ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {t("projects.evidence_approved_at", { date: new Date(task.evidence.approvedAt).toLocaleString() })}
                {task.evidence.approvedBy ? ` · ${task.evidence.approvedBy}` : ""}
              </p>
            ) : null}
            {otherPlans.length > 0 ? (
              <Select onValueChange={(value) => onMove(value as string)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={t("projects.move_task_to")} />
                </SelectTrigger>
                <SelectContent>
                  {otherPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {/* WorkBuddy: Task transfer packaging */}
            <button
              type="button"
              onClick={() => setShowTransfer((current) => !current)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Package size={12} />
                {t("projects.task_transfer")}
              </span>
              {transferSuccess ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">✓</Badge>
              ) : null}
            </button>
            {showTransfer ? (
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-[11px] text-muted-foreground">{t("projects.task_package_desc")}</p>
                {task.deliverables && task.deliverables.length > 0 ? (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium">{t("projects.task_deliverables")}:</span>
                    {task.deliverables.map((d, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">· {d.name}</p>
                    ))}
                  </div>
                ) : null}
                {task.progressSummary ? (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium">{t("projects.task_progress_summary")}:</span> {task.progressSummary}
                  </p>
                ) : null}
                {otherProjects.length > 0 ? (
                  <>
                    <Select value={transferTarget} onValueChange={(value) => setTransferTarget(value ?? "")}>
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder={t("projects.task_select_target")} />
                      </SelectTrigger>
                      <SelectContent>
                        {otherProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="xs"
                      onClick={handlePackageAndTransfer}
                      disabled={!transferTarget}
                    >
                      <Send size={11} className="mr-1" />
                      {t("projects.task_package_action")}
                    </Button>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{t("projects.task_no_other_projects")}</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type PlanCardProps = {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Pick<Plan, "status">>) => void;
  onRemove: () => void;
};

function PlanCard({ plan, selected, onSelect, onUpdate, onRemove }: PlanCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-lg border px-2.5 py-2 transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {plan.status === "done" ? (
              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
            ) : null}
            <span className="line-clamp-1">{plan.title}</span>
          </div>
          {plan.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{plan.description}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("projects.tasks", { count: plan.tasks.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title={t("projects.remove_plan")}
          aria-label={t("projects.remove_plan")}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-1.5">
        <Select
          value={plan.status}
          onValueChange={(value) => onUpdate({ status: value as PlanStatus })}
        >
          <SelectTrigger size="sm" className="h-7 gap-1 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("projects.plan_open")}</SelectItem>
            <SelectItem value="active">{t("projects.plan_active")}</SelectItem>
            <SelectItem value="done">{t("projects.plan_done")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ProjectDetailPanel(props: ProjectDetailPanelProps) {
  const project = useProject(props.projectId);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const addPlan = useProjectStore((state) => state.addPlan);
  const updatePlan = useProjectStore((state) => state.updatePlan);
  const removePlan = useProjectStore((state) => state.removePlan);
  const addTask = useProjectStore((state) => state.addTask);
  const updateTaskStatus = useProjectStore((state) => state.updateTaskStatus);
  const moveTask = useProjectStore((state) => state.moveTask);
  const setTaskEvidence = useProjectStore((state) => state.setTaskEvidence);
  const removeTask = useProjectStore((state) => state.removeTask);
  const addSubtask = useProjectStore((state) => state.addSubtask);
  const toggleSubtask = useProjectStore((state) => state.toggleSubtask);
  const removeSubtask = useProjectStore((state) => state.removeSubtask);
  const setTaskAssignee = useProjectStore((state) => state.setTaskAssignee);
  const connectorStates = useImConnectorStore((state) => state.states);
  const refreshConnectors = useImConnectorStore((state) => state.refresh);

  useEffect(() => {
    refreshConnectors();
  }, [refreshConnectors]);

  const [newPlan, setNewPlan] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newTask, setNewTask] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("tasks");
  const [showMembers, setShowMembers] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandFeedback, setCommandFeedback] = useState("");

  const setProjectThread = useProjectStore((state) => state.setProjectThread);
  const [activeThread, setActiveThread] = useState<string | null>(project?.threadId ?? null);
  const [threadBusy, setThreadBusy] = useState(false);

  useEffect(() => {
    setActiveThread(project?.threadId ?? null);
  }, [project?.threadId]);

  // Lazily bind a real OpenCode session to this project so the 任务 tab can run
  // the agent against the workspace, mirroring WorkBuddy's 对话 + 工作空间.
  useEffect(() => {
    if (activeTab !== "tasks" || activeThread || !props.createThread || !props.canCreateTask) return;
    let cancelled = false;
    setThreadBusy(true);
    void (async () => {
      const id = await props.createThread!();
      if (cancelled) return;
      if (id && props.workspaceId) {
        setProjectThread(props.projectId, { threadId: id, workspaceId: props.workspaceId });
        setActiveThread(id);
      }
      setThreadBusy(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeThread, props.createThread, props.canCreateTask, props.workspaceId, props.projectId, setProjectThread]);

  const threadSurface = activeThread && props.getThreadSurface ? props.getThreadSurface(activeThread) : null;

  const addActivityEvent = useProjectStore((state) => state.addActivityEvent);

  const handleCommand = () => {
    const text = commandInput.trim();
    if (!text || !project) return;

    const cmd = parseProjectCommand(text, project, selectedPlanId);

    switch (cmd.kind) {
      case "empty":
        return;

      case "create_task": {
        if (!selectedPlan) {
          setCommandFeedback(t("projects.command_no_plan"));
        } else {
          addTask(project.id, selectedPlan.id, cmd.title);
          setCommandFeedback(t("projects.command_create_task", { title: cmd.title }));
          addActivityEvent(project.id, t("projects.command_create_task", { title: cmd.title }), "mine");
        }
        break;
      }

      case "complete_task": {
        const keyword = cmd.keyword.toLowerCase();
        let found = false;
        for (const plan of project.plans) {
          for (const task of plan.tasks) {
            if (task.title.toLowerCase().includes(keyword) && task.status !== "done") {
              updateTaskStatus(project.id, plan.id, task.id, "done");
              setCommandFeedback(t("projects.command_complete_task", { title: task.title }));
              addActivityEvent(project.id, t("projects.command_complete_task", { title: task.title }), "mine");
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) setCommandFeedback(t("projects.command_no_match"));
        break;
      }

      case "assign_task": {
        const taskKeyword = cmd.keyword.toLowerCase();
        let found = false;
        for (const plan of project.plans) {
          for (const task of plan.tasks) {
            if (task.title.toLowerCase().includes(taskKeyword)) {
              setTaskAssignee(project.id, plan.id, task.id, cmd.assignee);
              setCommandFeedback(t("projects.command_assign_task", { task: task.title, assignee: cmd.assignee }));
              addActivityEvent(project.id, t("projects.command_assign_task", { task: task.title, assignee: cmd.assignee }), "member");
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) setCommandFeedback(t("projects.command_no_match"));
        break;
      }

      case "switch_plan": {
        const planName = cmd.name.toLowerCase();
        const plan = project.plans.find((p) => p.title.toLowerCase().includes(planName));
        if (plan) {
          setSelectedPlanId(plan.id);
          setCommandFeedback(t("projects.command_switch_plan", { title: plan.title }));
        } else {
          setCommandFeedback(t("projects.command_no_match"));
        }
        break;
      }

      case "note": {
        addActivityEvent(project.id, cmd.text, "mine");
        setCommandFeedback(cmd.text);
        break;
      }
    }

    setCommandInput("");
    setTimeout(() => setCommandFeedback(""), 3000);
  };

  useEffect(() => {
    if (project && !project.plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(project.plans[0]?.id ?? null);
    }
  }, [project, selectedPlanId]);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <span>{t("projects.project_not_found")}</span>
        {props.onBack ? (
          <Button variant="outline" size="sm" onClick={props.onBack}>
            {t("common.back")}
          </Button>
        ) : null}
      </div>
    );
  }

  const selectedPlan = project.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const handleAddPlan = () => {
    const title = newPlan.trim();
    if (!title) {
      return;
    }
    const projectId = project.id;
    addPlan(projectId, title, newPlanDesc.trim());
    setNewPlan("");
    setNewPlanDesc("");
  };

  const handleAddTask = () => {
    const title = newTask.trim();
    if (!selectedPlan || !title) {
      return;
    }
    addTask(project.id, selectedPlan.id, title);
    setNewTask("");
  };

  const handleDeleteProject = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteProject(project.id);
    setConfirmDelete(false);
    props.onBack?.();
  };

  const handleOneClickGenerate = () => {
    if (!activeThread) return;
    const planHint = selectedPlan ? `当前计划：${selectedPlan.title}。` : "";
    const prompt = `请根据项目「${project.name}」（${project.description || "无描述"}）${planHint}拆解出可执行的任务，并列出每个任务的标题。`;
    useComposerStateStore.getState().setDraft(activeThread, prompt);
    markComposerAutoSend(activeThread);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {props.onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={props.onBack}
              title={t("common.back")}
              aria-label={t("common.back")}
            >
              <ArrowLeft size={14} />
            </Button>
          ) : null}
          <h2 className="truncate text-sm font-semibold">{project.name}</h2>
          <Select
            value={project.status}
            onValueChange={(value) => updateProject(project.id, { status: value as "active" | "paused" | "done" })}
          >
            <SelectTrigger size="sm" className="h-7 gap-1 rounded-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("projects.status_active")}</SelectItem>
              <SelectItem value="paused">{t("projects.status_paused")}</SelectItem>
              <SelectItem value="done">{t("projects.status_done")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <DeviceSyncBadge />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowMembers((current) => !current)}
            title={t("projects.members_title")}
            aria-label={t("projects.members_title")}
            className={cn(showMembers && "text-primary")}
          >
            <Users size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDeleteProject}
            title={t("projects.delete_project")}
            aria-label={t("projects.delete_project")}
            className={cn(confirmDelete && "text-destructive")}
          >
            <Trash2 size={14} />
          </Button>
          {props.onClose ? (
            <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={t("common.close")} aria-label={t("common.close")}>
              <X size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      {/* WorkBuddy 对标：项目详情四视图切换（任务/动态/计划/资产） */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-1.5">
        {PROJECT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                activeTab === tab.id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              )}
            >
              <Icon size={14} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {activeTab === "tasks" ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t("projects.invite_banner")}</span>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowMembers(true)}>
              <UserPlus size={14} className="mr-1" />
              {t("projects.members_title")}
            </Button>
            <Button size="sm" onClick={handleOneClickGenerate} disabled={!activeThread}>
              <Sparkles size={14} className="mr-1" />
              {t("projects.one_click_generate")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Bindings summary */}
      {(project.skills.length > 0 || project.experts.length > 0 || project.connectors.length > 0) ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{t("projects.bindings_title")}</span>
          {project.skills.length > 0 ? (
            <span className="flex items-center gap-1">
              <Wrench size={10} />
              {project.skills.length} {t("projects.bind_skills")}
            </span>
          ) : null}
          {project.experts.length > 0 ? (
            <span className="flex items-center gap-1">
              <Bot size={10} />
              {project.experts.length} {t("projects.bind_experts")}
            </span>
          ) : null}
          {project.connectors.length > 0 ? (
            <span className="flex items-center gap-1">
              <MessagesSquare size={10} />
              {project.connectors.length} {t("projects.bind_connectors")}
              <span className="flex items-center gap-0.5">
                {project.connectors.map((cid) => {
                  const def = IM_CONNECTOR_DEFINITIONS.find((d) => d.id === cid);
                  const state = connectorStates.find((s) => s.id === cid);
                  const dotColor = state?.status === "connected"
                    ? "bg-emerald-500"
                    : state?.status === "connecting"
                      ? "bg-amber-500"
                      : "bg-muted-foreground";
                  return (
                    <span
                      key={cid}
                      className={cn("size-1.5 shrink-0 rounded-full", dotColor)}
                      title={def?.name ?? cid}
                    />
                  );
                })}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
      {activeTab === "tasks" ? (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 @4xl:flex-row">
        {/* 智能体：绑定项目的真实 OpenCode 会话 */}
        <div className="flex min-h-0 flex-col @4xl:w-[42%] @4xl:max-w-[520px]">
          {threadSurface ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
              <SessionSurface {...threadSurface} />
            </div>
          ) : props.canCreateTask ? (
            <div className="flex min-h-[16rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
              <MessagesSquare size={20} />
              <span>{threadBusy ? t("projects.chat_starting") : t("projects.chat_empty")}</span>
            </div>
          ) : (
            <div className="flex min-h-[16rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
              <MessagesSquare size={20} />
              <span>{t("projects.chat_needs_workspace")}</span>
            </div>
          )}
        </div>

        {/* 工作空间：产物 / 变更 / 全部文件 */}
        <div className="flex min-h-0 flex-col @4xl:w-[26%]">
          <ProjectWorkspaceColumn
            client={props.client}
            workspaceId={project.workspaceId ?? props.workspaceId ?? null}
          />
        </div>

        {/* 任务：计划选择 + 按状态分组的列表 */}
        <Card variant="outline" size="sm" className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="shrink-0 gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListChecks size={14} />
                {t("projects.column_tasks")}
              </CardTitle>
              {selectedPlan ? (
                <span className="text-xs text-muted-foreground">
                  {planTaskProgress(selectedPlan).done}/{planTaskProgress(selectedPlan).total}
                </span>
              ) : null}
            </div>
            {project.plans.length > 0 ? (
              <Select
                value={selectedPlanId ?? project.plans[0]?.id ?? ""}
                onValueChange={(value) => setSelectedPlanId(value)}
              >
                <SelectTrigger size="sm" className="h-8 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {project.plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className="flex gap-2">
              <input
                value={newPlan}
                onChange={(event) => setNewPlan(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAddPlan();
                }}
                placeholder={t("projects.add_plan")}
                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              <Button size="sm" variant="outline" onClick={handleAddPlan} disabled={newPlan.trim().length === 0}>
                <Plus size={14} className="mr-1" />
                {t("projects.add_plan")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {!selectedPlan ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ListChecks size={20} />
                <span>{t("projects.no_plans_hint")}</span>
              </div>
            ) : (
              <>
                <div className="mb-3 flex shrink-0 gap-2">
                  <input
                    value={newTask}
                    onChange={(event) => setNewTask(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleAddTask();
                    }}
                    placeholder={t("projects.task_placeholder")}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                  <Button size="icon-sm" variant="outline" onClick={handleAddTask} disabled={newTask.trim().length === 0} title={t("projects.add_task")} aria-label={t("projects.add_task")}>
                    <Plus size={14} />
                  </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <ScrollAreaViewport className="pr-1">
                    <div className="flex flex-col gap-4">
                      {groupTasksByStatus(selectedPlan).map((group) => (
                        <div key={group.status} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", TASK_COLUMN_META[group.status].dot)} />
                            <span className="text-xs font-medium text-muted-foreground">
                              {t(TASK_COLUMN_META[group.status].key)}
                            </span>
                            <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                          </div>
                          {group.tasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              planId={selectedPlan.id}
                              projectId={project.id}
                              projectPlans={project.plans}
                              onStatusChange={(next) =>
                                updateTaskStatus(project.id, selectedPlan.id, task.id, next)
                              }
                              onEvidenceChange={(evidence) =>
                                setTaskEvidence(project.id, selectedPlan.id, task.id, evidence)
                              }
                              onMove={(toPlanId) =>
                                moveTask(project.id, task.id, selectedPlan.id, toPlanId)
                              }
                              onRemove={() => removeTask(project.id, selectedPlan.id, task.id)}
                              onAddSubtask={(title) =>
                                addSubtask(project.id, selectedPlan.id, task.id, title)
                              }
                              onToggleSubtask={(subtaskId) =>
                                toggleSubtask(project.id, selectedPlan.id, task.id, subtaskId)
                              }
                              onRemoveSubtask={(subtaskId) =>
                                removeSubtask(project.id, selectedPlan.id, task.id, subtaskId)
                              }
                              onAssigneeChange={(assignee) =>
                                setTaskAssignee(project.id, selectedPlan.id, task.id, assignee)
                              }
                              onDragStart={() => setDragTaskId(task.id)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </ScrollAreaViewport>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      ) : activeTab === "activity" ? (
        <ProjectActivityView project={project} />
      ) : activeTab === "plans" ? (
        <ProjectPlansView project={project} onOpenTasks={() => setActiveTab("tasks")} />
      ) : (
        <ProjectAssetsView project={project} />
      )}
        </div>
        {showMembers ? (
          <ProjectMembersView projectId={project.id} onClose={() => setShowMembers(false)} />
        ) : null}
      </div>

      {/* Command input box */}
      <div className="shrink-0 border-t border-border px-4 py-2">
        {commandFeedback ? (
          <div className="mb-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
            {commandFeedback}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommand();
            }}
            placeholder={t("projects.command_placeholder")}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button
            size="icon-sm"
            variant="outline"
            onClick={handleCommand}
            disabled={commandInput.trim().length === 0}
            title="Send"
            aria-label="Send"
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- 项目四视图：动态 / 计划 / 资产 ----------

const PROJECT_TABS: ReadonlyArray<{ id: ProjectTab; labelKey: string; icon: typeof Activity }> = [
  { id: "tasks", labelKey: "projects.tab_tasks", icon: ListChecks },
  { id: "plans", labelKey: "projects.tab_plans", icon: LayoutList },
  { id: "assets", labelKey: "projects.tab_assets", icon: Boxes },
  { id: "activity", labelKey: "projects.tab_activity", icon: Activity },
];

const ACTIVITY_FILTERS: ReadonlyArray<{ id: ActivityCategory; labelKey: string }> = [
  { id: "all", labelKey: "projects.activity_filter_all" },
  { id: "mine", labelKey: "projects.activity_filter_mine" },
  { id: "member", labelKey: "projects.activity_filter_member" },
  { id: "automation", labelKey: "projects.activity_filter_automation" },
];

function ProjectActivityView({ project }: { project: Project }) {
  const [filter, setFilter] = useState<ActivityCategory>("all");

  const events = useMemo(() => {
    const items: ActivityEvent[] = [];
    for (const plan of project.plans) {
      items.push({ date: plan.createdAt, textKey: "projects.activity_plan_created", title: plan.title, category: "mine" });
      if (plan.status === "done") {
        items.push({ date: plan.createdAt, textKey: "projects.activity_plan_done", title: plan.title, category: "mine" });
      }
      for (const task of plan.tasks) {
        items.push({ date: task.createdAt, textKey: "projects.activity_task_created", title: task.title, category: "mine" });
        if (task.status === "done") {
          items.push({ date: task.createdAt, textKey: "projects.activity_task_done", title: task.title, category: "mine" });
        }
        if (task.evidence.status === "passed" && task.evidence.approvedAt) {
          items.push({ date: task.evidence.approvedAt, textKey: "projects.activity_task_evidence", title: task.title, category: "mine" });
        }
        if (task.assignee) {
          items.push({ date: task.createdAt, textKey: "projects.activity_member_joined", title: task.assignee, category: "member" });
        }
      }
    }
    items.push({ date: project.createdAt, textKey: "projects.activity_automation_run", title: project.name, category: "automation" });
    for (const event of project.activityEvents) {
      items.push({ date: event.createdAt, textKey: "", title: event.text, category: event.category });
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [project]);

  const filteredEvents = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-1">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>
      {filteredEvents.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {t("projects.activity_empty")}
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {filteredEvents.map((event, index) => (
            <li key={index} className="relative">
              <span className={cn(
                "absolute -left-[23px] top-1 size-2 rounded-full ring-4",
                event.category === "member" ? "bg-sky-500/40 ring-sky-500/10" :
                event.category === "automation" ? "bg-amber-500/40 ring-amber-500/10" :
                "bg-primary/40 ring-primary/10",
              )} />
              <div className="text-sm leading-5">
                {event.textKey
                  ? t(event.textKey, { date: formatDateTime(event.date), title: event.title })
                  : event.title}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type WorkspaceTab = "artifacts" | "changes" | "files";

function ProjectWorkspaceColumn({
  client,
  workspaceId,
}: {
  client?: import("@/app/lib/openwork-server").OpenworkServerClient | null;
  workspaceId: string | null;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("artifacts");
  const tabs: ReadonlyArray<{ id: WorkspaceTab; labelKey: string }> = [
    { id: "artifacts", labelKey: "projects.workspace_tab_artifacts" },
    { id: "changes", labelKey: "projects.workspace_tab_changes" },
    { id: "files", labelKey: "projects.workspace_tab_files" },
  ];
  return (
    <Card variant="outline" size="sm" className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 gap-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Package size={14} />
          {t("projects.column_workspace")}
        </CardTitle>
        <div className="flex gap-1">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                tab === entry.id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              )}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {tab === "files" && client && workspaceId ? (
          <div className="h-full min-h-[12rem]">
            <WorkspaceFilesPanel
              client={client}
              workspaceId={workspaceId}
              onOpenFile={() => {}}
              onClose={() => {}}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Boxes size={20} />
            <span>
              {tab === "artifacts"
                ? t("projects.workspace_empty_artifacts")
                : tab === "changes"
                  ? t("projects.workspace_empty_changes")
                  : t("projects.workspace_empty_files")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectPlansView({ project, onOpenTasks }: { project: Project; onOpenTasks: () => void }) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <p className="text-xs text-muted-foreground">{t("projects.plans_view_desc")}</p>
      {project.plans.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {t("projects.no_plans")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {project.plans.map((plan) => {
            const done = plan.tasks.filter((task) => task.status === "done").length;
            const total = plan.tasks.length;
            const percent = total === 0 ? 0 : Math.round((done / total) * 100);
            const statusKey = plan.status === "done" ? "projects.plan_done" : plan.status === "active" ? "projects.plan_active" : "projects.plan_open";
            return (
              <Card key={plan.id} variant="outline" size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <LayoutList size={14} className="shrink-0" />
                      <span className="truncate">{plan.title}</span>
                    </span>
                    <Badge variant="outline">{t(statusKey)}</Badge>
                  </CardTitle>
                  {plan.description ? (
                    <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("projects.plans_progress", { done, total })}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1" onClick={onOpenTasks}>
                    <ListChecks size={14} className="mr-1" />
                    {t("projects.board_title")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectMembersView({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [members, setMembers] = useState<ProjectMember[]>([
    { id: "owner", name: "Owner", role: "owner", joinedAt: new Date().toISOString() },
  ]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, role: "member", joinedAt: new Date().toISOString() },
    ]);
    setNewMemberName("");
  };

  const removeMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const createInvite = () => {
    const link = `https://openwork.local/invite/${projectId}/${crypto.randomUUID().slice(0, 8)}`;
    setInvites((prev) => [
      { id: crypto.randomUUID(), link, status: "pending", createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const copyLink = (inviteId: string, link: string) => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
    setInvites((prev) =>
      prev.map((inv) => (inv.id === inviteId ? { ...inv, status: "approved" } : inv)),
    );
  };

  const updateInviteStatus = (inviteId: string, status: InviteStatus) => {
    setInvites((prev) =>
      prev.map((inv) => (inv.id === inviteId ? { ...inv, status } : inv)),
    );
  };

  return (
    <div className="flex w-64 shrink-0 flex-col border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium">{t("projects.members_title")}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="space-y-3 p-3">
            {/* Member list */}
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("projects.members_empty")}</p>
            ) : (
              <div className="space-y-1.5">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {member.role === "owner" ? t("projects.members_role_owner") : t("projects.members_role_member")}
                      </p>
                    </div>
                    {member.role !== "owner" ? (
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        title={t("projects.members_remove")}
                        aria-label={t("projects.members_remove")}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Add member */}
            <div className="flex gap-1.5">
              <input
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addMember();
                }}
                placeholder={t("projects.members_add")}
                className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-input/50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              <Button size="icon-sm" variant="outline" onClick={addMember} disabled={newMemberName.trim().length === 0}>
                <UserPlus size={12} />
              </Button>
            </div>

            {/* Invite section */}
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[11px] font-medium">{t("projects.invite_title")}</p>
              <p className="text-[10px] text-muted-foreground">{t("projects.invite_desc")}</p>
              <Button size="xs" variant="outline" onClick={createInvite}>
                <Link2 size={10} className="mr-1" />
                {t("projects.invite_create")}
              </Button>

              {invites.length > 0 ? (
                <div className="space-y-1.5">
                  {invites.map((invite) => (
                    <div key={invite.id} className="space-y-1 rounded-lg border border-border p-2">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            invite.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : invite.status === "rejected"
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {invite.status === "pending"
                            ? t("projects.invite_pending")
                            : invite.status === "approved"
                              ? t("projects.invite_approved")
                              : t("projects.invite_rejected")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTime(invite.createdAt)}
                        </span>
                      </div>
                      {invite.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => copyLink(invite.id, invite.link)}
                            className="flex-1"
                          >
                            <Copy size={9} className="mr-1" />
                            {copiedId === invite.id ? "✓" : t("projects.invite_copy_link")}
                          </Button>
                        </div>
                      ) : null}
                      {invite.status === "approved" ? (
                        <div className="flex gap-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => updateInviteStatus(invite.id, "approved")}
                          >
                            {t("projects.invite_approve")}
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => updateInviteStatus(invite.id, "rejected")}
                          >
                            {t("projects.invite_reject")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}

function ProjectAssetsView({ project }: { project: Project }) {
  const assets = useMemo(() => {
    const items: Array<{ id: string; name: string; type: "task" | "evidence"; status: string; updatedAt: string }> = [];
    for (const plan of project.plans) {
      for (const task of plan.tasks) {
        items.push({
          id: task.id,
          name: task.title,
          type: "task",
          status: task.status,
          updatedAt: task.createdAt,
        });
        if (task.evidence.status !== "pending") {
          items.push({
            id: `${task.id}-evidence`,
            name: task.evidence.notes || task.title,
            type: "evidence",
            status: task.evidence.status,
            updatedAt: task.evidence.approvedAt ?? task.createdAt,
          });
        }
      }
    }
    return items;
  }, [project]);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {assets.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {t("projects.assets_empty")}
        </div>
      ) : (
        <Card variant="outline" size="sm">
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t("projects.assets_table_name")}</th>
                  <th className="px-4 py-2 font-medium">{t("projects.assets_table_type")}</th>
                  <th className="px-4 py-2 font-medium">{t("projects.assets_table_status")}</th>
                  <th className="px-4 py-2 font-medium">{t("projects.assets_table_updated")}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[24rem] truncate px-4 py-2">{asset.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant={asset.type === "evidence" ? "outline" : "secondary"}>
                        {t(asset.type === "evidence" ? "projects.assets_type_evidence" : "projects.assets_type_task")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {asset.type === "task" ? (
                        <Badge className={TASK_COLUMN_META[asset.status as TaskStatus]?.dot}>
                          {t(TASK_COLUMN_META[asset.status as TaskStatus]?.key ?? "projects.evidence_pending")}
                        </Badge>
                      ) : (
                        <Badge className={EVIDENCE_META[asset.status as EvidenceStatus]?.className}>
                          {t(EVIDENCE_META[asset.status as EvidenceStatus]?.key ?? "projects.evidence_pending")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(asset.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}