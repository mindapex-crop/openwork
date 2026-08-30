/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, Plus, Search, Sparkles, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentLocale } from "../../../i18n";
import { cn } from "@/lib/utils";

import { ExpertCard } from "./expert-card";
import { ExpertDetailModal } from "./expert-detail-modal";
import { ExpertDetailPanel, type ExpertDetailLabels } from "./expert-detail-panel";
import { ExpertForm, type ExpertFormLabels } from "./expert-form";
import { filterExperts, useExpertsStore } from "./experts-store";
import { ExpertGroupCard, type ExpertGroupCardLabels } from "./expert-group-card";
import { ExpertGroupDialog, type ExpertGroupDialogLabels } from "./expert-group-dialog";
import { ExpertGroupResultPanel } from "./expert-group-result";
import type { ExpertGroup, ExpertGroupInput, ExpertGroupResult } from "./expert-group-types";
import { runExpertGroup } from "./expert-group-runner";
import { useExpertGroupStore } from "./expert-group-store";
import type { Expert, ExpertInput } from "./types";

/** 精选场景数据（WorkBuddy 风格） */
const FEATURED_SCENARIOS = [
  {
    id: "back-to-school",
    title: "开学季",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop",
    experts: ["校园求职教练", "论文写作导师", "校园活动策划与执行顾问"],
  },
  {
    id: "content-creation",
    title: "内容创作",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    experts: ["内容创作专家团", "内容创作专家", "小红书运营专家"],
  },
  {
    id: "investment",
    title: "投资分析",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop",
    experts: ["交易分析团队", "股票研究专家", "腾讯自选股股票投研专家团"],
  },
  {
    id: "legal",
    title: "法律咨询",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop",
    experts: ["法律检索专家", "资深合同法务专家", "财税合规专家团"],
  },
  {
    id: "small-business",
    title: "小微企业",
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=300&fit=crop",
    experts: ["销售教练", "微信公众号运营专家", "创业伙伴"],
  },
];

/** 分类标签 */
const EXPERT_CATEGORIES = [
  "全部",
  "OPC·一人公司",
  "腾讯专家",
  "产品设计",
  "技术工程",
  "开学季",
  "高校新生攻略",
  "金融投资",
  "全球发展",
  "教育学习",
  "游戏空间",
  "数据智能",
  "营销增长",
  "内容创作",
  "销售",
];

/**
 * 页面级双语字典（全局 i18n 由他人负责，这里仅定义本页文案，不触碰 locales）。
 * key 使用 experts.* 前缀。
 */
const EXPERTS_DICT = {
  zh: {
    "experts.list.title": "专家",
    "experts.list.tab": "专家",
    "experts.list.tabGroups": "专家组",
    "experts.list.subtitle": "创建和复用你的专属专家：配置角色、技能与工作方法。",
    "experts.list.searchPlaceholder": "搜索专家：名称、描述、技能、模型…",
    "experts.list.newExpert": "新建专家",
    "experts.list.emptyTitle": "还没有专家",
    "experts.list.emptyHint": "创建第一位专家，把常用的角色设定与技能打包复用。",
    "experts.list.loading": "正在加载专家…",
    "experts.list.loadFailed": "加载专家失败：{error}",
    "experts.list.retry": "重试",
    "experts.list.count": "共 {count} 位专家",
    "experts.detail.title": "专家详情",
    "experts.detail.back": "返回列表",
    "experts.detail.edit": "编辑",
    "experts.detail.delete": "删除",
    "experts.detail.close": "关闭",
    "experts.detail.methodology": "工作方法",
    "experts.detail.systemPrompt": "System Prompt",
    "experts.detail.skills": "绑定技能",
    "experts.detail.noSkills": "未绑定技能",
    "experts.detail.model": "推荐模型",
    "experts.deleteConfirm": "确定删除专家「{name}」吗？此操作不可撤销。",
    "experts.deleteFailed": "删除失败：{error}",
    "experts.form.titleCreate": "新建专家",
    "experts.form.titleEdit": "编辑专家",
    "experts.form.subtitle": "配置专家的角色、能力与工作方法。",
    "experts.form.name": "名称",
    "experts.form.namePlaceholder": "例如：代码审查专家",
    "experts.form.nameRequired": "请填写专家名称。",
    "experts.form.description": "描述",
    "experts.form.descriptionPlaceholder": "一句话说明专家的职责",
    "experts.form.category": "分类",
    "experts.form.systemPrompt": "System Prompt",
    "experts.form.systemPromptPlaceholder": "定义专家的系统指令…",
    "experts.form.systemPromptRequired": "请填写 System Prompt。",
    "experts.form.methodology": "工作方法",
    "experts.form.methodologyPlaceholder": "描述专家处理任务的流程与原则（可选）",
    "experts.form.skills": "绑定技能",
    "experts.form.skillsHint": "从本地技能目录中多选，供专家调用。",
    "experts.form.model": "推荐模型",
    "experts.form.modelPlaceholder": "例如：deepseek-coder",
    "experts.form.save": "保存",
    "experts.form.saving": "保存中…",
    "experts.form.cancel": "取消",
    "experts.form.close": "关闭",
    "experts.form.back": "返回",
    "experts.form.saveFailed": "保存失败，请重试。",
    "experts.group.emptyTitle": "还没有专家组",
    "experts.group.emptyHint": "创建第一个专家组，将多位专家组织为协作团队。",
    "experts.group.newGroup": "新建专家组",
    "experts.group.count": "共 {count} 个专家组",
    "experts.group.newMember": "添加成员",
    "experts.group.removeMember": "移除",
    "experts.group.resultTitle": "执行结果",
    "experts.group.promptPlaceholder": "输入任务描述…",
    "experts.group.strategyConservative": "保守",
    "experts.group.strategyBalanced": "平衡",
    "experts.group.strategyAggressive": "激进",
    "experts.group.membersSuffix": "成员",
    "experts.group.run": "运行",
    "experts.group.edit": "编辑",
    "experts.group.delete": "删除",
    "experts.group.result.resultTitle": "执行结果",
    "experts.group.result.prompt": "任务：",
    "experts.group.result.startedAt": "开始时间：",
    "experts.group.result.endedAt": "结束时间：",
    "experts.group.result.synthesis": "综合汇总",
    "experts.group.result.statusPending": "等待",
    "experts.group.result.statusRunning": "执行中",
    "experts.group.result.statusCompleted": "完成",
    "experts.group.result.statusFailed": "失败",
    "experts.group.result.overallCompleted": "已完成",
    "experts.group.result.overallFailed": "失败",
    "experts.group.result.overallRunning": "执行中",
    "experts.group.deleteConfirm": "确定删除专家组「{name}」吗？此操作不可撤销。",
    "experts.groupDialog.titleCreate": "新建专家组",
    "experts.groupDialog.titleEdit": "编辑专家组",
    "experts.groupDialog.subtitle": "将多位专家组织为协作团队，组长负责拆解与汇总。",
    "experts.groupDialog.name": "名称",
    "experts.groupDialog.namePlaceholder": "例如：代码审查团队",
    "experts.groupDialog.nameRequired": "请填写专家组名称。",
    "experts.groupDialog.description": "描述",
    "experts.groupDialog.descriptionPlaceholder": "一句话说明专家组的职责",
    "experts.groupDialog.leader": "组长",
    "experts.groupDialog.leaderPlaceholder": "选择组长专家",
    "experts.groupDialog.leaderRequired": "请选择组长。",
    "experts.groupDialog.members": "成员",
    "experts.groupDialog.membersPlaceholder": "暂无成员，点击下方按钮添加。",
    "experts.groupDialog.strategy": "策略",
    "experts.groupDialog.addMember": "添加成员",
    "experts.groupDialog.removeMember": "移除",
    "experts.groupDialog.save": "保存",
    "experts.groupDialog.saving": "保存中…",
    "experts.groupDialog.cancel": "取消",
    "experts.groupDialog.saveFailed": "保存失败，请重试。",
  },
  en: {
    "experts.list.title": "Experts",
    "experts.list.tab": "Experts",
    "experts.list.tabGroups": "Expert Groups",
    "experts.list.subtitle": "Create and reuse your own experts: role, skills, and methodology in one place.",
    "experts.list.searchPlaceholder": "Search experts by name, description, skill, model…",
    "experts.list.newExpert": "New Expert",
    "experts.list.emptyTitle": "No experts yet",
    "experts.list.emptyHint": "Create your first expert to package a reusable role and skills.",
    "experts.list.loading": "Loading experts…",
    "experts.list.loadFailed": "Failed to load experts: {error}",
    "experts.list.retry": "Retry",
    "experts.list.count": "{count} experts",
    "experts.detail.title": "Expert Detail",
    "experts.detail.back": "Back to list",
    "experts.detail.edit": "Edit",
    "experts.detail.delete": "Delete",
    "experts.detail.close": "Close",
    "experts.detail.methodology": "Methodology",
    "experts.detail.systemPrompt": "System Prompt",
    "experts.detail.skills": "Bound Skills",
    "experts.detail.noSkills": "No skills bound",
    "experts.detail.model": "Recommended model",
    "experts.deleteConfirm": "Delete expert “{name}”? This cannot be undone.",
    "experts.deleteFailed": "Failed to delete: {error}",
    "experts.form.titleCreate": "New Expert",
    "experts.form.titleEdit": "Edit Expert",
    "experts.form.subtitle": "Configure the expert's role, capabilities, and methodology.",
    "experts.form.name": "Name",
    "experts.form.namePlaceholder": "e.g., Code Review Expert",
    "experts.form.nameRequired": "Name is required.",
    "experts.form.description": "Description",
    "experts.form.descriptionPlaceholder": "One line about what this expert does",
    "experts.form.category": "Category",
    "experts.form.systemPrompt": "System Prompt",
    "experts.form.systemPromptPlaceholder": "Define the expert's system instructions…",
    "experts.form.systemPromptRequired": "System Prompt is required.",
    "experts.form.methodology": "Methodology",
    "experts.form.methodologyPlaceholder": "How the expert approaches tasks (optional)",
    "experts.form.skills": "Bound Skills",
    "experts.form.skillsHint": "Select skills from the local catalog the expert can call.",
    "experts.form.model": "Recommended model",
    "experts.form.modelPlaceholder": "e.g., deepseek-coder",
    "experts.form.save": "Save",
    "experts.form.saving": "Saving…",
    "experts.form.cancel": "Cancel",
    "experts.form.close": "Close",
    "experts.form.back": "Back",
    "experts.form.saveFailed": "Save failed. Please try again.",
    "experts.group.emptyTitle": "No expert groups yet",
    "experts.group.emptyHint": "Create your first expert group to organize multiple experts as a team.",
    "experts.group.newGroup": "New Expert Group",
    "experts.group.count": "{count} expert groups",
    "experts.group.newMember": "Add Member",
    "experts.group.removeMember": "Remove",
    "experts.group.resultTitle": "Execution Result",
    "experts.group.promptPlaceholder": "Enter task description…",
    "experts.group.strategyConservative": "Conservative",
    "experts.group.strategyBalanced": "Balanced",
    "experts.group.strategyAggressive": "Aggressive",
    "experts.group.membersSuffix": "members",
    "experts.group.run": "Run",
    "experts.group.edit": "Edit",
    "experts.group.delete": "Delete",
    "experts.group.result.resultTitle": "Execution Result",
    "experts.group.result.prompt": "Prompt: ",
    "experts.group.result.startedAt": "Started: ",
    "experts.group.result.endedAt": "Ended: ",
    "experts.group.result.synthesis": "Synthesis",
    "experts.group.result.statusPending": "Pending",
    "experts.group.result.statusRunning": "Running",
    "experts.group.result.statusCompleted": "Completed",
    "experts.group.result.statusFailed": "Failed",
    "experts.group.result.overallCompleted": "Completed",
    "experts.group.result.overallFailed": "Failed",
    "experts.group.result.overallRunning": "Running",
    "experts.group.deleteConfirm": "Delete expert group \"{name}\"? This cannot be undone.",
    "experts.groupDialog.titleCreate": "New Expert Group",
    "experts.groupDialog.titleEdit": "Edit Expert Group",
    "experts.groupDialog.subtitle": "Organize multiple experts into a collaborative team with a leader.",
    "experts.groupDialog.name": "Name",
    "experts.groupDialog.namePlaceholder": "e.g., Code Review Team",
    "experts.groupDialog.nameRequired": "Name is required.",
    "experts.groupDialog.description": "Description",
    "experts.groupDialog.descriptionPlaceholder": "One line about what this group does",
    "experts.groupDialog.leader": "Leader",
    "experts.groupDialog.leaderPlaceholder": "Select a leader expert",
    "experts.groupDialog.leaderRequired": "Leader is required.",
    "experts.groupDialog.members": "Members",
    "experts.groupDialog.membersPlaceholder": "No members yet. Click the button below to add.",
    "experts.groupDialog.strategy": "Strategy",
    "experts.groupDialog.addMember": "Add Member",
    "experts.groupDialog.removeMember": "Remove",
    "experts.groupDialog.save": "Save",
    "experts.groupDialog.saving": "Saving…",
    "experts.groupDialog.cancel": "Cancel",
    "experts.groupDialog.saveFailed": "Save failed. Please try again.",
  },
} as const;

type ExpertsDictKey = keyof (typeof EXPERTS_DICT)["zh"];

type ExpertsDict = Record<ExpertsDictKey, string>;

const pickDict = (): ExpertsDict => (currentLocale() === "zh" ? EXPERTS_DICT.zh : EXPERTS_DICT.en);

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

type ExpertsTab = "experts" | "groups";

type ExpertsView =
  | { kind: "list" }
  | { kind: "detail"; expertId: string }
  | { kind: "edit"; expertId: string | null };

type GroupsView =
  | { kind: "list" }
  | { kind: "result"; groupId: string };

export type ExpertsPageProps = {
  onClose?: () => void;
};

export function ExpertsPage(props: ExpertsPageProps) {
  const dict = pickDict();
  const experts = useExpertsStore((state) => state.experts);
  const status = useExpertsStore((state) => state.status);
  const error = useExpertsStore((state) => state.error);
  const fetchExperts = useExpertsStore((state) => state.fetchExperts);
  const createExpert = useExpertsStore((state) => state.createExpert);
  const updateExpert = useExpertsStore((state) => state.updateExpert);
  const deleteExpert = useExpertsStore((state) => state.deleteExpert);

  // 专家组 store
  const groups = useExpertGroupStore((state) => state.groups);
  const createGroup = useExpertGroupStore((state) => state.createGroup);
  const updateGroup = useExpertGroupStore((state) => state.updateGroup);
  const deleteGroup = useExpertGroupStore((state) => state.deleteGroup);

  const [tab, setTab] = useState<ExpertsTab>("experts");
  const [view, setView] = useState<ExpertsView>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [sortBy, setSortBy] = useState<"comprehensive" | "hottest" | "newest">("comprehensive");

  // 专家组视图状态
  const [groupsView, setGroupsView] = useState<GroupsView>({ kind: "list" });
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<ExpertGroupResult | null>(null);
  const [runPrompt, setRunPrompt] = useState("");
  const [modalExpert, setModalExpert] = useState<Expert | null>(null);

  useEffect(() => {
    void fetchExperts();
  }, [fetchExperts]);

  const filtered = useMemo(() => filterExperts(experts, query), [experts, query]);

  const selected = useMemo(() => {
    if (view.kind !== "detail") return null;
    return experts.find((expert) => expert.id === view.expertId) ?? null;
  }, [view, experts]);

  const editing = useMemo(() => {
    if (view.kind !== "edit") return null;
    return experts.find((expert) => expert.id === view.expertId) ?? null;
  }, [view, experts]);

  const detailLabels = useMemo<ExpertDetailLabels>(
    () => ({
      title: dict["experts.detail.title"],
      methodology: dict["experts.detail.methodology"],
      systemPrompt: dict["experts.detail.systemPrompt"],
      skills: dict["experts.detail.skills"],
      noSkills: dict["experts.detail.noSkills"],
      model: dict["experts.detail.model"],
      back: dict["experts.detail.back"],
      edit: dict["experts.detail.edit"],
      delete: dict["experts.detail.delete"],
      close: dict["experts.detail.close"],
    }),
    [dict],
  );

  const formLabels = useMemo<ExpertFormLabels>(
    () => ({
      titleCreate: dict["experts.form.titleCreate"],
      titleEdit: dict["experts.form.titleEdit"],
      subtitle: dict["experts.form.subtitle"],
      name: dict["experts.form.name"],
      namePlaceholder: dict["experts.form.namePlaceholder"],
      nameRequired: dict["experts.form.nameRequired"],
      description: dict["experts.form.description"],
      descriptionPlaceholder: dict["experts.form.descriptionPlaceholder"],
      category: dict["experts.form.category"],
      systemPrompt: dict["experts.form.systemPrompt"],
      systemPromptPlaceholder: dict["experts.form.systemPromptPlaceholder"],
      systemPromptRequired: dict["experts.form.systemPromptRequired"],
      methodology: dict["experts.form.methodology"],
      methodologyPlaceholder: dict["experts.form.methodologyPlaceholder"],
      skills: dict["experts.form.skills"],
      skillsHint: dict["experts.form.skillsHint"],
      model: dict["experts.form.model"],
      modelPlaceholder: dict["experts.form.modelPlaceholder"],
      save: dict["experts.form.save"],
      saving: dict["experts.form.saving"],
      cancel: dict["experts.form.cancel"],
      close: dict["experts.form.close"],
      back: dict["experts.form.back"],
      saveFailed: dict["experts.form.saveFailed"],
    }),
    [dict],
  );

  const handleDelete = (expert: Expert) => {
    const confirmed = globalThis.confirm?.(format(dict["experts.deleteConfirm"], { name: expert.name })) ?? true;
    if (!confirmed) return;
    void deleteExpert(expert.id).then((ok) => {
      if (ok && view.kind === "detail" && view.expertId === expert.id) {
        setView({ kind: "list" });
      }
    });
  };

  const handleSubmit = async (input: ExpertInput) => {
    if (view.kind === "edit" && view.expertId) {
      await updateExpert(view.expertId, input);
      setView({ kind: "detail", expertId: view.expertId });
    } else {
      const created = await createExpert(input);
      if (created) {
        setView({ kind: "detail", expertId: created.id });
      }
    }
  };

  const groupDialogLabels = useMemo<ExpertGroupDialogLabels>(
    () => ({
      titleCreate: dict["experts.groupDialog.titleCreate"],
      titleEdit: dict["experts.groupDialog.titleEdit"],
      subtitle: dict["experts.groupDialog.subtitle"],
      name: dict["experts.groupDialog.name"],
      namePlaceholder: dict["experts.groupDialog.namePlaceholder"],
      nameRequired: dict["experts.groupDialog.nameRequired"],
      description: dict["experts.groupDialog.description"],
      descriptionPlaceholder: dict["experts.groupDialog.descriptionPlaceholder"],
      leader: dict["experts.groupDialog.leader"],
      leaderPlaceholder: dict["experts.groupDialog.leaderPlaceholder"],
      leaderRequired: dict["experts.groupDialog.leaderRequired"],
      members: dict["experts.groupDialog.members"],
      membersPlaceholder: dict["experts.groupDialog.membersPlaceholder"],
      strategy: dict["experts.groupDialog.strategy"],
      addMember: dict["experts.groupDialog.addMember"],
      removeMember: dict["experts.groupDialog.removeMember"],
      save: dict["experts.groupDialog.save"],
      saving: dict["experts.groupDialog.saving"],
      cancel: dict["experts.groupDialog.cancel"],
      saveFailed: dict["experts.groupDialog.saveFailed"],
    }),
    [dict],
  );

  const groupCardLabels = useMemo(
    () => ({
      strategyConservative: dict["experts.group.strategyConservative"],
      strategyBalanced: dict["experts.group.strategyBalanced"],
      strategyAggressive: dict["experts.group.strategyAggressive"],
      membersSuffix: dict["experts.group.membersSuffix"],
      run: dict["experts.group.run"],
      edit: dict["experts.group.edit"],
      delete: dict["experts.group.delete"],
    }),
    [dict],
  );

  const groupResultLabels = useMemo(
    () => ({
      resultTitle: dict["experts.group.result.resultTitle"],
      prompt: dict["experts.group.result.prompt"],
      startedAt: dict["experts.group.result.startedAt"],
      endedAt: dict["experts.group.result.endedAt"],
      synthesis: dict["experts.group.result.synthesis"],
      statusPending: dict["experts.group.result.statusPending"],
      statusRunning: dict["experts.group.result.statusRunning"],
      statusCompleted: dict["experts.group.result.statusCompleted"],
      statusFailed: dict["experts.group.result.statusFailed"],
      overallCompleted: dict["experts.group.result.overallCompleted"],
      overallFailed: dict["experts.group.result.overallFailed"],
      overallRunning: dict["experts.group.result.overallRunning"],
    }),
    [dict],
  );

  const handleGroupSubmit = async (input: ExpertGroupInput) => {
    if (editingGroupId) {
      await updateGroup(editingGroupId, input);
    } else {
      await createGroup(input);
    }
    setGroupDialogOpen(false);
    setEditingGroupId(null);
  };

  const handleGroupDelete = (group: ExpertGroup) => {
    const confirmed = globalThis.confirm?.(format(dict["experts.group.deleteConfirm"], { name: group.name })) ?? true;
    if (!confirmed) return;
    void deleteGroup(group.id);
  };

  const handleRunGroup = async (group: ExpertGroup) => {
    setRunResult(null);
    setGroupsView({ kind: "result", groupId: group.id });
    try {
      const result = await runExpertGroup(group, runPrompt);
      setRunResult(result);
    } catch (err) {
      setRunResult({
        groupId: group.id,
        prompt: runPrompt,
        status: "failed",
        members: [
          { expertId: group.leaderId, status: "failed", error: err instanceof Error ? err.message : String(err) },
          ...group.memberIds.map((id) => ({ expertId: id, status: "failed" as const })),
        ],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }
  };

  // 专家组结果视图
  if (tab === "groups" && groupsView.kind === "result") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => { setGroupsView({ kind: "list" }); setRunResult(null); setRunPrompt(""); }}>
              <X size={14} />
            </Button>
            <h2 className="text-sm font-semibold">{dict["experts.group.resultTitle"]}</h2>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ScrollAreaViewport>
            <div className="p-4">
              {runResult ? (
                <ExpertGroupResultPanel result={runResult} labels={groupResultLabels} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  <p className="mt-2 text-sm">…</p>
                </div>
              )}
            </div>
          </ScrollAreaViewport>
        </ScrollArea>
    </div>
  );
}

  if (view.kind === "detail" && selected) {
    return (
      <ExpertDetailPanel
        expert={selected}
        labels={detailLabels}
        onBack={() => setView({ kind: "list" })}
        onClose={props.onClose}
        onEdit={(expert) => setView({ kind: "edit", expertId: expert.id })}
        onDelete={handleDelete}
      />
    );
  }

  if (view.kind === "edit" && tab === "experts") {
    return (
      <ExpertForm
        initial={editing}
        labels={formLabels}
        onBack={() => (editing ? setView({ kind: "detail", expertId: editing.id }) : setView({ kind: "list" }))}
        onCancel={() => (editing ? setView({ kind: "detail", expertId: editing.id }) : setView({ kind: "list" }))}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold">{dict["experts.list.title"]}</h2>
        </div>
        {props.onClose ? (
          <Button variant="ghost" size="icon-sm" onClick={props.onClose} title={dict["experts.list.title"]} aria-label={dict["experts.list.title"]}>
            <X size={14} />
          </Button>
        ) : null}
      </div>

      {/* Tab 切换 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as ExpertsTab)} className="border-b border-border px-4 py-2">
        <TabsList className="grid w-auto grid-cols-2">
          <TabsTrigger value="experts" className="gap-1.5">
            <UserRound size={12} />
            {dict["experts.list.tab"]}
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <Network size={12} />
            {dict["experts.list.tabGroups"]}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 精选场景 Hero */}
      {tab === "experts" ? (
        <div className="border-b border-border px-4 py-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">精选场景</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {FEATURED_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className="group relative min-w-[200px] flex-1 overflow-hidden rounded-xl bg-muted/50 transition-all hover:ring-2 hover:ring-primary/30"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={scenario.image}
                    alt={scenario.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h4 className="mb-1.5 text-sm font-semibold text-white">{scenario.title}</h4>
                  <div className="flex flex-col gap-1">
                    {scenario.experts.slice(0, 3).map((expert, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-white/90">
                        <div className="size-4 rounded-full bg-white/20" />
                        <span className="truncate">{expert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 分类标签 + 排序 */}
      {tab === "experts" ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {EXPERT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  category === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setSortBy("comprehensive")}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                sortBy === "comprehensive" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              综合
            </button>
            <button
              type="button"
              onClick={() => setSortBy("hottest")}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                sortBy === "hottest" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              最热
            </button>
            <button
              type="button"
              onClick={() => setSortBy("newest")}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                sortBy === "newest" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              最新
            </button>
          </div>
        </div>
      ) : null}

      {/* 专家列表 */}
      {tab === "experts" ? (
        <ExpertsListView
          dict={dict}
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          status={status}
          error={error}
          experts={experts}
          fetchExperts={fetchExperts}
          setView={setView}
          handleDelete={handleDelete}
          modalExpert={modalExpert}
          setModalExpert={setModalExpert}
        />
      ) : null}

      {/* 专家组列表 */}
      {tab === "groups" ? (
        <GroupsListView
          dict={dict}
          groups={groups}
          labels={groupCardLabels}
          setEditingGroupId={setEditingGroupId}
          setGroupDialogOpen={setGroupDialogOpen}
          handleGroupDelete={handleGroupDelete}
          handleRunGroup={handleRunGroup}
          runPrompt={runPrompt}
          setRunPrompt={setRunPrompt}
        />
      ) : null}

      {/* 专家组创建/编辑弹窗 */}
      <ExpertGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        initial={editingGroupId ? groups.find((g) => g.id === editingGroupId) : null}
        labels={groupDialogLabels}
        onSubmit={(input) => handleGroupSubmit(input)}
      />
    </div>
  );
}

// ---------- 专家列表子视图 ----------

type ExpertsListViewProps = {
  dict: ExpertsDict;
  query: string;
  setQuery: (q: string) => void;
  filtered: Expert[];
  status: string;
  error: string | null;
  experts: Expert[];
  fetchExperts: () => Promise<void>;
  setView: (view: ExpertsView) => void;
  handleDelete: (expert: Expert) => void;
  modalExpert: Expert | null;
  setModalExpert: (expert: Expert | null) => void;
};

function ExpertsListView(props: ExpertsListViewProps) {
  const { dict, query, setQuery, filtered, status, error, experts, fetchExperts, setView, handleDelete, modalExpert, setModalExpert } = props;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict["experts.list.searchPlaceholder"]}
            className="h-8 pl-9 rounded-lg"
            aria-label={dict["experts.list.searchPlaceholder"]}
          />
        </div>
        <Button size="sm" onClick={() => setView({ kind: "edit", expertId: null })}>
          <Plus size={14} />
          {dict["experts.list.newExpert"]}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <UserRound size={12} />
        <span>{format(dict["experts.list.count"], { count: String(experts.length) })}</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="p-4">
            {status === "error" ? (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
                <span>{format(dict["experts.list.loadFailed"], { error: error ?? "" })}</span>
                <Button variant="outline" size="sm" onClick={() => void fetchExperts()}>
                  {dict["experts.list.retry"]}
                </Button>
              </div>
            ) : null}

            {status === "loading" && experts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {dict["experts.list.loading"]}
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
                <UserRound className="mb-3 size-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {query ? "—" : dict["experts.list.emptyTitle"]}
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {query ? dict["experts.list.searchPlaceholder"] : dict["experts.list.emptyHint"]}
                </p>
                {!query ? (
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setView({ kind: "edit", expertId: null })}>
                    <Plus className="size-3.5" />
                    {dict["experts.list.newExpert"]}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className={cn("grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3")}>
                {filtered.map((expert) => (
                  <ExpertCard
                    key={expert.id}
                    expert={expert}
                    onOpen={(entry) => {
                      setView({ kind: "detail", expertId: entry.id });
                      setModalExpert(entry);
                    }}
                    onEdit={(entry) => setView({ kind: "edit", expertId: entry.id })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>

      <ExpertDetailModal
        expert={modalExpert}
        open={modalExpert !== null}
        onClose={() => setModalExpert(null)}
        onSummon={(expert) => {
          console.log("Summon expert:", expert.name);
          setModalExpert(null);
        }}
      />
    </>
  );
}

// ---------- 专家组列表子视图 ----------

type GroupsListViewProps = {
  dict: ExpertsDict;
  groups: ExpertGroup[];
  labels: ExpertGroupCardLabels;
  setEditingGroupId: (id: string | null) => void;
  setGroupDialogOpen: (open: boolean) => void;
  handleGroupDelete: (group: ExpertGroup) => void;
  handleRunGroup: (group: ExpertGroup) => Promise<void>;
  runPrompt: string;
  setRunPrompt: (prompt: string) => void;
};

function GroupsListView(props: GroupsListViewProps) {
  const { dict, groups, labels, setEditingGroupId, setGroupDialogOpen, handleGroupDelete, handleRunGroup, runPrompt, setRunPrompt } = props;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative flex-1">
          <Input
            value={runPrompt}
            onChange={(event) => setRunPrompt(event.target.value)}
            placeholder={dict["experts.group.promptPlaceholder"]}
            className="h-8 rounded-lg"
            aria-label={dict["experts.group.promptPlaceholder"]}
          />
        </div>
        <Button size="sm" onClick={() => { setEditingGroupId(null); setGroupDialogOpen(true); }}>
          <Plus size={14} />
          {dict["experts.group.newGroup"]}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <Network size={12} />
        <span>{format(dict["experts.group.count"], { count: String(groups.length) })}</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport>
          <div className="p-4">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
                <Network className="mb-3 size-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {dict["experts.group.emptyTitle"]}
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {dict["experts.group.emptyHint"]}
                </p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => { setEditingGroupId(null); setGroupDialogOpen(true); }}>
                  <Plus className="size-3.5" />
                  {dict["experts.group.newGroup"]}
                </Button>
              </div>
            ) : (
              <div className={cn("grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3")}>
                {groups.map((group) => (
                  <ExpertGroupCard
                    key={group.id}
                    group={group}
                    labels={labels}
                    onEdit={(g) => { setEditingGroupId(g.id); setGroupDialogOpen(true); }}
                    onDelete={handleGroupDelete}
                    onRun={(g) => void handleRunGroup(g)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </>
  );
}
