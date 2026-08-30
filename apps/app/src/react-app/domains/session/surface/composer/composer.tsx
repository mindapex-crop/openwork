/** @jsxImportSource react */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Agent } from "@opencode-ai/sdk/v2/client";
import { AppWindowMac, ArrowUp, Bot, BookOpen, Check, ChevronDown, ChevronRight, FileCode, FileText, FolderOpen, GitBranch, ListPlus, LoaderCircle, Mic, Paperclip, Plug, Plus, RefreshCw, Settings, Shield, ShieldCheck, Square, Target, Terminal, TerminalSquare, Video, X, Zap } from "lucide-react";
import fuzzysort from "fuzzysort";
import { toast } from "@/components/ui/sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  OPENWORK_EXTENSION_CATALOG,
  filterOpenWorkExtensionCatalogForPlatform,
  resolveOpenWorkExtensionCatalogPlatform,
  type McpDirectoryInfo,
} from "@/app/constants";
import type { CloudImportedPlugin, CloudImportedPluginFile } from "@/app/cloud/import-state";
import type { ComposerAttachment, McpServerEntry, McpStatusMap, ModelOption, ModelRef, SkillCard, SlashCommandOption } from "@/app/types";
import { isMacPlatform } from "@/app/utils";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { TASK_MODE_OPTIONS, type TaskMode } from "../../chat/task-mode";
import { isOpenWorkExtensionEnabled, isOpenWorkExtensionHidden, OPENWORK_EXTENSION_STATE_CHANGED } from "@/react-app/domains/settings/extension-state";
import { IM_CONNECTOR_DEFINITIONS, useImConnectorStore } from "@/react-app/domains/settings/im-connector-store";
import { useExpertsStore } from "@/react-app/domains/experts/experts-store";
import { useDesktopRestriction } from "@/react-app/domains/cloud/desktop-config-provider";
import { usePlatform } from "@/react-app/kernel/platform";
import { resolveExtensionIconUrl } from "@/react-app/design-system/extension-icon-src";
import { ModelBehaviorSelect } from "@/components/model-behavior-select";
import { ModelSelect } from "@/components/model-select";
import { LexicalPromptEditor, syncAttachmentChipStatus, type LexicalPromptEditorHandle } from "./editor";
import { listRunningAppsForMention } from "./app-mentions";
import type { ComposerMentionKind } from "./mention-encoding";
import {
  connectSkillSlashCommandOptions,
  getSlashCommandQuery,
  skillMenuSlashCommandName,
  skillSlashCommandName,
  type ComposerSlashCommandOption,
} from "./slash-command";
import { encodeConnectSkillToken } from "./connect-skill-token";
import { useComposerCapabilityStore } from "./composer-capability-store";
import { clearSessionGoal, useSessionGoalStore } from "./composer-goal-store";
import { formatGoalProgress, type GoalStatus } from "./composer-goal";
import { isScreenRecordingSupported } from "@/react-app/domains/capture";
import { FILE_URL_RE, HTTP_URL_RE, type PastedTextChip } from "./pasted-text";
import { QUICK_COMMAND_DEFINITIONS, useQuickCommandsStore } from "./composer-quick-commands";
import { QuickActionButton } from "./composer-quick-action-button";
import {
  getComposerActions,
  type ComposerContributionContext,
} from "./composer-contributions";

export type MentionItem = {
  id: string;
  kind: ComposerMentionKind;
  value: string;
  label: string;
  description?: string;
};

type ToolMenuSettingsSection = "commands" | "skills" | "mcps" | "plugins" | "extensions";
type ToolMenuSection =
  | "agents"
  | "commands"
  | "skills"
  | "mcps"
  | "extensions"
  | "experts"
  | "connectors"
  | `plugin:${string}`;

/** 「管理智能体 / 管理连接器」跳转目标（由宿主路由实现，composer 只负责触发）。 */
export type CapabilityManagerKind = "experts" | "connectors";

function isComposerExtensionAvailable(entry: McpDirectoryInfo) {
  const hasSessionSurface = entry.extensionManifest?.contributions?.some((contribution) =>
    contribution.type === "session-side-panel" || contribution.type === "session-rail-item"
  ) === true;
  if (hasSessionSurface) return isOpenWorkExtensionEnabled(entry);
  return !entry.defaultEnabled || isOpenWorkExtensionEnabled(entry);
}

type ComposerProps = {
  draft: string;
  mentions: Record<string, ComposerMentionKind>;
  onDraftChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onSteer: () => void | Promise<void>;
  onQueue: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  busy: boolean;
  steering: boolean;
  submissionPreparing: boolean;
  queuedCount: number;
  disabled: boolean;
  modelUnavailable?: boolean;
  modelUnavailableMessage?: string | null;
  organizationModelsEmpty?: boolean;
  statusLabel: string;
  modelPickerOpen: boolean;
  selectedModel: ModelRef;
  modelOptions?: readonly ModelOption[];
  /** When set, the full model picker opened from here targets this session. */
  sessionId?: string;
  openWorkModelsEntitled?: boolean;
  openWorkModelsSyncing?: boolean;
  onRefreshOrganizationModels?: () => void | Promise<void>;
  onModelPickerOpenChange: (open: boolean) => void;
  onModelChange: (model: ModelRef) => void;
  attachments: ComposerAttachment[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  attachmentsEnabled: boolean;
  /** True while the draft's attachments are being compressed/uploaded during a send; chips show a spinner overlay. */
  attachmentsUploading?: boolean;
  attachmentsDisabledReason: string | null;
  /** Opens the screen recorder. Absent on surfaces that do not host one, so the menu item hides. */
  onRecordScreen?: () => void;
  modelVariantLabel: string;
  modelVariant: string | null;
  modelBehaviorOptions?: { value: string | null; label: string }[];
  onModelVariantChange: (value: string | null) => void;
  agentLabel: string;
  selectedAgent: string | null;
  /** True when selectedAgent is an injected CLI agent (source === "openwork"). */
  agentIsCli?: boolean;
  /** The selected CLI agent's built-in default model (Agent.model). */
  agentDefaultModel?: ModelRef | null;
  listAgents: () => Promise<Agent[]>;
  onSelectAgent: (agent: string | null) => void;
  listCommands: () => Promise<SlashCommandOption[]>;
  listSkills?: () => Promise<SkillCard[]>;
  skills?: SkillCard[];
  listMcp?: () => Promise<{ servers: McpServerEntry[]; statuses: McpStatusMap; status: string | null }>;
  mcpServers?: McpServerEntry[];
  mcpStatus?: string | null;
  mcpStatuses?: McpStatusMap;
  listImportedPlugins?: () => Promise<CloudImportedPlugin[]>;
  importedPlugins?: CloudImportedPlugin[];
  onOpenSettingsSection?: (section: ToolMenuSettingsSection) => void;
  /** 跳转到智能体 / 连接器的管理页（WorkBuddy「管理连接器」对标）。 */
  onOpenCapabilityManager?: (kind: CapabilityManagerKind) => void;
  recentFiles: string[];
  searchFiles: (query: string) => Promise<string[]>;
  onInsertMention: (kind: ComposerMentionKind, value: string) => void;
  /** Sent-prompt history (oldest first) recalled with ArrowUp/ArrowDown (#2012). */
  inputHistory?: string[];
  onPasteText: (text: string) => void;
  onUnsupportedFileLinks: (links: string[]) => void;
  pastedText: PastedTextChip[];
  onExpandPastedText: (id: string) => void;
  onRemovePastedText: (id: string) => void;
  isRemoteWorkspace: boolean;
  isSandboxWorkspace: boolean;
  /** Extra mention items (docs, git, terminal, rules) injected by the session surface via the mention provider. */
  extraMentionItems?: MentionItem[];
  onUploadInboxFiles?: ((files: File[]) => void | Promise<unknown>) | null;
  draftScopeKey?: string;
  compactTopSpacing?: boolean;
  /** Render inline in a page (new-task hero): no sticky dock chrome or inner max-width, aligning with sibling content. */
  flush?: boolean;
  topAccessory?: ReactNode;
  /** Ask / Plan / Craft 任务模式（WorkBuddy 输入区对标）；未传时隐藏模式切换。 */
  taskMode?: TaskMode;
  onTaskModeChange?: (mode: TaskMode) => void;
  /** 当前工作空间（WorkBuddy "设置工作空间" 对标）。 */
  workspaceLabel?: string;
  workspaceOptions?: { id: string; label: string; active: boolean }[];
  onWorkspaceSelect?: (workspaceId: string) => void;
  onOpenCreateWorkspace?: () => void;
  /** 权限模式（WorkBuddy "权限管理：默认权限 / 完全访问" 对标）。 */
  permissionMode?: "manual" | "full";
  onPermissionModeChange?: (mode: "manual" | "full") => void;
  /** Auto mode toggle (WorkBuddy "Auto" 对标). */
  autoMode?: boolean;
  onAutoModeChange?: (auto: boolean) => void;
  /** Voice input (WorkBuddy 麦克风图标 对标). */
  voiceInputSupported?: boolean;
  voiceInputActive?: boolean;
  onVoiceInput?: () => void;
};

const FLUSH_PROMPT_EVENT = "openwork:flushPromptDraft";
const FOCUS_PROMPT_EVENT = "openwork:focusPrompt";
const DEFAULT_AGENT_NAME = "openwork";

function isNonDefaultAgent(agent: Agent) {
  return agent.name !== DEFAULT_AGENT_NAME;
}

/**
 * Extract external file/URL drops from a clipboard. Only used when the user
 * drag-drops a file reference from another app (Finder / browser), which sets
 * the text/uri-list MIME type explicitly. Plain text pastes — even ones that
 * contain absolute paths like "/Users/..." — are NEVER treated as links here
 * because that intercepted real text pastes and made composer paste feel
 * broken. Plain text goes straight into the editor via Lexical's default.
 */
function parseClipboardUriList(clipboard: DataTransfer) {
  const raw = clipboard.getData("text/uri-list") ?? "";
  if (!raw.trim()) return [];
  const links: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!FILE_URL_RE.test(trimmed) && !HTTP_URL_RE.test(trimmed)) continue;
    const normalized = encodeURI(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
  }
  return links;
}

function isImageAttachment(attachment: ComposerAttachment) {
  return attachment.kind === "image" || attachment.mimeType.startsWith("image/");
}

/** Ask / Plan / Craft 任务模式分段控件（WorkBuddy 输入区对标）。 */
function TaskModeSelect({
  value,
  onChange,
  disabled,
}: {
  value: TaskMode;
  onChange?: (mode: TaskMode) => void;
  disabled?: boolean;
}) {
  if (!onChange) return null;
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-full border border-border/70 bg-muted/40 p-0.5">
      {TASK_MODE_OPTIONS.map((mode) => {
        const ModeIcon = mode.icon;
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            title={mode.description}
            aria-label={mode.label}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(mode.value)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow-[0_1px_0_rgba(255,255,255,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ModeIcon className="size-3" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

/** 工作空间选择器（WorkBuddy "设置工作空间" 对标）：显示当前工作空间，点击切换或新建。 */
function WorkspaceSelect({
  label,
  options,
  onSelect,
  onCreate,
  disabled,
}: {
  label?: string;
  options?: { id: string; label: string; active: boolean }[];
  onSelect?: (workspaceId: string) => void;
  onCreate?: () => void;
  disabled?: boolean;
}) {
  if (!label && (!options || options.length === 0)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 max-h-9 max-w-[180px] items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-gray-10 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:opacity-50"
            disabled={disabled}
            title={t("composer.workspace_label")}
            aria-label={t("composer.workspace_label")}
          >
            <FolderOpen size={14} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChevronDown size={13} className="shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-64">
        <div className="border-b border-dls-border px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-10">
          {t("composer.workspace_label")}
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {(options ?? []).map((option) => (
            <DropdownMenuItem
              key={option.id}
              disabled={option.active || disabled}
              onClick={() => onSelect?.(option.id)}
            >
              <FolderOpen size={14} className="text-gray-9" />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.active ? <Check size={14} className="shrink-0 text-gray-10" /> : null}
            </DropdownMenuItem>
          ))}
        </div>
        <div className="border-t border-dls-border p-1.5">
          <DropdownMenuItem onClick={onCreate} disabled={disabled}>
            <Plus size={14} className="text-gray-9" />
            <span className="min-w-0 flex-1 truncate">{t("workspace_list.add_workspace")}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 权限模式开关（WorkBuddy "权限管理：默认权限 / 完全访问" 对标）。 */
function PermissionModeToggle({
  value,
  onChange,
  disabled,
}: {
  value?: "manual" | "full";
  onChange?: (mode: "manual" | "full") => void;
  disabled?: boolean;
}) {
  if (!onChange) return null;
  const full = value === "full";
  return (
    <button
      type="button"
      className={`inline-flex h-9 max-h-9 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-50 ${
        full
          ? "bg-amber-3/60 text-amber-11 hover:bg-amber-4/60"
          : "text-gray-10 hover:bg-gray-3 hover:text-gray-12"
      }`}
      onClick={() => onChange(full ? "manual" : "full")}
      disabled={disabled}
      title={full ? t("composer.permission_full_hint") : t("composer.permission_manual_hint")}
      aria-label={full ? t("composer.permission_full") : t("composer.permission_manual")}
      aria-pressed={full}
    >
      {full ? <ShieldCheck size={14} className="shrink-0" /> : <Shield size={14} className="shrink-0" />}
      <span className="hidden sm:inline">{full ? t("composer.permission_full") : t("composer.permission_manual")}</span>
    </button>
  );
}

function formatMcpStatusLabel(status: McpServerStatus | undefined) {
  switch (status) {
    case "connected":
      return t("mcp.friendly_status_ready");
    case "needs_auth":
    case "needs_client_registration":
      return t("mcp.friendly_status_needs_signin");
    case "disabled":
      return t("mcp.friendly_status_paused");
    case "disconnected":
      return t("mcp.friendly_status_offline");
    case "failed":
    default:
      return t("mcp.friendly_status_issue");
  }
}

type McpServerStatus = "connected" | "needs_auth" | "needs_client_registration" | "failed" | "disabled" | "disconnected";

function toReactMcpStatus(name: string, entry: McpServerEntry, statuses: McpStatusMap): McpServerStatus {
  const configured = statuses[name];
  if (configured?.status === "connected") return "connected";
  if (configured?.status === "needs_auth") return "needs_auth";
  if (configured?.status === "needs_client_registration") return "needs_client_registration";
  if (configured?.status === "failed") return "failed";
  if (configured?.status === "disabled" || entry.config.enabled === false || entry.config.enabled === undefined && entry.config.type === "local" && entry.config.command?.length === 0) {
    return entry.config.enabled === false ? "disabled" : configured?.status === "disabled" ? "disabled" : "disconnected";
  }
  return "disconnected";
}

function mcpStatusBadgeClass(status: McpServerStatus) {
  switch (status) {
    case "connected":
      return "bg-green-3 text-green-11";
    case "needs_auth":
    case "needs_client_registration":
      return "bg-amber-3 text-amber-11";
    case "disabled":
    case "disconnected":
      return "bg-gray-3 text-gray-11";
    default:
      return "bg-red-3 text-red-11";
  }
}

function goalChipClass(status: GoalStatus) {
  switch (status) {
    case "complete":
      return "bg-green-3 text-green-11";
    case "blocked":
      return "bg-amber-3 text-amber-11";
    case "active":
      return "bg-gray-2 text-gray-12";
  }
}

function isLocalCapability(origin: SkillCard["origin"] | McpServerEntry["origin"]) {
  return origin !== "openwork-connect";
}

function extensionIcon(entry: McpDirectoryInfo, size = 16) {
  const serviceUrl = typeof entry.url === "string" ? entry.url : undefined;
  const iconUrl = resolveExtensionIconUrl({ iconSrc: entry.iconSrc, iconSlug: entry.iconSlug, serviceUrl });
  if (iconUrl) {
    return <img src={iconUrl} alt="" width={size} height={size} loading="lazy" style={{ display: "block" }} />;
  }
  return <Plug size={size} className="text-gray-9" />;
}

function formatPluginObjectType(type: string) {
  const normalized = type.trim().toLowerCase();
  if (!normalized) return "File";
  if (normalized === "mcp") return "MCP";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function pluginSlashCommandName(file: CloudImportedPluginFile) {
  const path = file.path.trim();
  if (file.objectType === "command") {
    const command = path.match(/^\.opencode\/(?:command|commands)\/(.+)\.md$/i)?.[1];
    return command?.trim() || null;
  }
  if (file.objectType === "skill") {
    const skill = path.match(/^\.opencode\/(?:skill|skills)\/(?:[^/]+\/)?([^/]+)\/SKILL\.md$/i)?.[1];
    return skill?.trim() || null;
  }
  return null;
}

export function ReactSessionComposer(props: ComposerProps) {
  const platform = usePlatform();
  const builtInExtensionsDisabled = useDesktopRestriction("allowBuiltInExtensions");
  let fileInput: HTMLInputElement | undefined;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [refreshingOrganizationModels, setRefreshingOrganizationModels] = useState(false);
  const [commands, setCommands] = useState<SlashCommandOption[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skills, setSkills] = useState<SkillCard[]>(props.skills ?? []);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>(props.mcpServers ?? []);
  const [mcpStatus, setMcpStatus] = useState<string | null>(props.mcpStatus ?? null);
  const [mcpStatuses, setMcpStatuses] = useState<McpStatusMap>(props.mcpStatuses ?? {});
  const [importedPlugins, setImportedPlugins] = useState<CloudImportedPlugin[]>(props.importedPlugins ?? []);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolMenuSection, setToolMenuSection] = useState<ToolMenuSection>("commands");
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const commandsCacheRef = useRef<SlashCommandOption[] | null>(null);
  const commandsRequestRef = useRef<Promise<SlashCommandOption[]> | null>(null);
  const skillsRequestRef = useRef<Promise<SkillCard[]> | null>(null);
  const commandsLoadVersionRef = useRef(0);
  const listCommandsRef = useRef(props.listCommands);
  const listSkillsRef = useRef(props.listSkills);
  const listMcpRef = useRef(props.listMcp);
  const listImportedPluginsRef = useRef(props.listImportedPlugins);
  const toolMenuLoadRef = useRef({
    openId: 0,
    commands: false,
    skills: false,
    mcps: false,
    plugins: false,
  });
  const [commandsLoaded, setCommandsLoaded] = useState(false);
  const [skillsLoaded, setSkillsLoaded] = useState(Boolean(props.skills?.length));
  const [mcpLoaded, setMcpLoaded] = useState(Boolean(props.mcpServers?.length));
  const [pluginsLoaded, setPluginsLoaded] = useState(Boolean(props.importedPlugins?.length));
  const [, setExtensionStateVersion] = useState(0);
  const [agentMenuIndex, setAgentMenuIndex] = useState(0);
  const agentItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement | null>(null);
  // WorkBuddy 对标：composer「+」菜单引用智能体 / 连接器。
  const selectedExpertId = useComposerCapabilityStore((state) => state.expertId);
  const selectedConnectorIds = useComposerCapabilityStore((state) => state.connectorIds);
  const setCapabilityExpert = useComposerCapabilityStore((state) => state.setExpert);
  const toggleCapabilityConnector = useComposerCapabilityStore((state) => state.toggleConnector);
  const sessionGoal = useSessionGoalStore((state) =>
    props.sessionId ? state.goals[props.sessionId] ?? null : null,
  );
  const activeQuickCommands = useQuickCommandsStore((state) => state.active);
  const experts = useExpertsStore((state) => state.experts);
  const fetchExperts = useExpertsStore((state) => state.fetchExperts);
  const connectorStates = useImConnectorStore((state) => state.states);
  const refreshConnectors = useImConnectorStore((state) => state.refresh);
  const editorRef = useRef<LexicalPromptEditorHandle | null>(null);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  // IME composition guard: while an IME composition is active, we must not
  // treat Enter as a submit. Three signals keep this reliable across WebKit,
  // Chrome, and Safari: event.isComposing, event.keyCode === 229, and the
  // compositionstart/compositionend events below.
  const imeComposingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(props.draft);
  useEffect(() => {
    draftRef.current = props.draft;
  }, [props.draft]);

  // Follow-up message UX (only relevant while the agent is busy):
  // - Enter sends immediately (the agent adjusts mid-task, aka "steer").
  // - Cmd/Ctrl+Enter queues the message to send once the agent finishes.
  // - Escape arms a "Hit Escape again to stop the agent" prompt for 3s;
  //   a second Escape within that window stops the agent.
  const [escapeArmed, setEscapeArmed] = useState(false);
  const escapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarmEscape = useCallback(() => {
    if (escapeTimerRef.current) {
      clearTimeout(escapeTimerRef.current);
      escapeTimerRef.current = null;
    }
    setEscapeArmed(false);
  }, []);

  // Reset the escape-to-stop prompt whenever the agent stops being busy.
  useEffect(() => {
    if (!props.busy) disarmEscape();
  }, [props.busy, disarmEscape]);

  useEffect(() => {
    if (props.steering && props.modelPickerOpen) {
      props.onModelPickerOpenChange(false);
    }
  }, [props.modelPickerOpen, props.onModelPickerOpenChange, props.steering]);

  const handleRefreshOrganizationModels = useCallback(async () => {
    if (!props.onRefreshOrganizationModels || refreshingOrganizationModels) return;

    setRefreshingOrganizationModels(true);
    try {
      await props.onRefreshOrganizationModels();
    } catch {
      toast.error(t("models.refresh_organization_models_failed"));
    } finally {
      setRefreshingOrganizationModels(false);
    }
  }, [props.onRefreshOrganizationModels, refreshingOrganizationModels]);

  // Input history recall (#2012): ArrowUp on an empty composer recalls the
  // previous sent prompt; repeated ArrowUp/ArrowDown walk the history.
  // Editing the recalled text exits recall mode, and ArrowDown past the
  // newest entry restores whatever was typed before recall started.
  const historyPosRef = useRef<number | null>(null);
  const historyExpectedRef = useRef<string | null>(null);
  const historyStashRef = useRef("");

  useEffect(() => {
    if (historyPosRef.current === null) return;
    if (props.draft !== historyExpectedRef.current) {
      historyPosRef.current = null;
      historyExpectedRef.current = null;
    }
  }, [props.draft]);

  useEffect(() => () => {
    if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
  }, []);

  // Editor submit (Enter). While idle this sends normally; while busy
  // Enter sends immediately (steer) and Cmd/Ctrl+Enter queues the
  // message to send once the agent finishes the current task.
  const handleEditorSubmit = useCallback((options: { queue: boolean }) => {
    const hasContent = props.draft.trim().length > 0 || props.attachments.length > 0;
    if (!hasContent) return;
    if (props.submissionPreparing) return;
    if (props.busy) {
      if (options.queue) void props.onQueue();
      else void props.onSteer();
      return;
    }
    void props.onSend();
  }, [props.busy, props.draft, props.attachments, props.onSend, props.onSteer, props.onQueue, props.submissionPreparing]);

  const slashCommandQuery = getSlashCommandQuery(props.draft);
  const slashOpenNext = slashCommandQuery !== null;
  const slashQuery = slashCommandQuery ?? "";
  const mentionMatch = props.draft.match(/@([^\s@]*)$/);
  const mentionOpenNext = Boolean(mentionMatch);
  const mentionQuery = mentionMatch?.[1] ?? "";
  const nonDefaultAgents = useMemo(() => agents.filter(isNonDefaultAgent), [agents]);
  const showAgentPicker = props.selectedAgent !== null || nonDefaultAgents.length > 0;

  useEffect(() => {
    setSlashOpen(slashOpenNext);
    setMenuIndex(0);
  }, [slashOpenNext, slashQuery]);

  useEffect(() => {
    setMentionOpen(mentionOpenNext);
    setMenuIndex(0);
  }, [mentionOpenNext, mentionQuery]);

  useEffect(() => {
    if (!agentMenuOpen && !(toolMenuOpen && toolMenuSection === "agents")) return;
    void props.listAgents().then(setAgents).catch(() => setAgents([]));
  }, [agentMenuOpen, toolMenuOpen, toolMenuSection, props.listAgents]);

  useEffect(() => {
    if (!showAgentPicker) setAgentMenuOpen(false);
  }, [showAgentPicker]);

  useEffect(() => {
    let cancelled = false;
    void props.listAgents().then((next) => {
      if (!cancelled) setAgents(next);
    }).catch(() => {
      if (!cancelled) setAgents([]);
    });
    return () => {
      cancelled = true;
    };
  }, [props.listAgents]);

  useEffect(() => {
    setSkills(props.skills ?? []);
  }, [props.skills]);

  useEffect(() => {
    setMcpServers(props.mcpServers ?? []);
    setMcpStatus(props.mcpStatus ?? null);
    setMcpStatuses(props.mcpStatuses ?? {});
  }, [props.mcpServers, props.mcpStatus, props.mcpStatuses]);

  useEffect(() => {
    setImportedPlugins(props.importedPlugins ?? []);
  }, [props.importedPlugins]);

  useEffect(() => {
    listCommandsRef.current = props.listCommands;
  }, [props.listCommands]);

  useEffect(() => {
    listSkillsRef.current = props.listSkills;
  }, [props.listSkills]);

  useEffect(() => {
    listMcpRef.current = props.listMcp;
  }, [props.listMcp]);

  useEffect(() => {
    listImportedPluginsRef.current = props.listImportedPlugins;
  }, [props.listImportedPlugins]);

  useEffect(() => {
    setAgentMenuIndex(0);
  }, [agentMenuOpen]);

  useEffect(() => {
    const target = agentItemRefs.current[agentMenuIndex];
    target?.scrollIntoView({ block: "nearest" });
  }, [agentMenuIndex, agentMenuOpen]);

  useEffect(() => {
    commandsLoadVersionRef.current += 1;
    commandsCacheRef.current = null;
    commandsRequestRef.current = null;
  }, [props.listCommands]);

  const loadCommands = useCallback(() => {
    if (commandsCacheRef.current !== null) {
      return Promise.resolve(commandsCacheRef.current);
    }
    if (commandsRequestRef.current) {
      return commandsRequestRef.current;
    }
    const version = commandsLoadVersionRef.current;
    const request = listCommandsRef.current().then((next) => {
      if (commandsLoadVersionRef.current === version) {
        commandsCacheRef.current = next;
      }
      return next;
    }).finally(() => {
      if (commandsLoadVersionRef.current === version) {
        commandsRequestRef.current = null;
      }
    });
    commandsRequestRef.current = request;
    return request;
  }, []);

  const loadSkills = useCallback(() => {
    if (skillsRequestRef.current) return skillsRequestRef.current;
    const listSkills = listSkillsRef.current;
    if (!listSkills) return Promise.resolve([]);
    const request = listSkills().finally(() => {
      if (skillsRequestRef.current === request) skillsRequestRef.current = null;
    });
    skillsRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    const refresh = () => setExtensionStateVersion((value) => value + 1);
    window.addEventListener(OPENWORK_EXTENSION_STATE_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OPENWORK_EXTENSION_STATE_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!toolMenuOpen) return;
    toolMenuLoadRef.current = {
      openId: toolMenuLoadRef.current.openId + 1,
      commands: false,
      skills: false,
      mcps: false,
      plugins: false,
    };
    setCommandsLoaded(false);
    setSkillsLoaded(Boolean(props.skills?.length));
    setMcpLoaded(Boolean(props.mcpServers?.length));
    setPluginsLoaded(Boolean(props.importedPlugins?.length));
  }, [toolMenuOpen]);

  useEffect(() => {
    if (!slashOpen && !toolMenuOpen) return;
    const openId = toolMenuLoadRef.current.openId;
    if (toolMenuOpen && toolMenuLoadRef.current.commands) return;
    if (toolMenuOpen) toolMenuLoadRef.current.commands = true;
    let cancelled = false;
    const cached = commandsCacheRef.current;
    if (cached !== null) {
      setCommands(cached);
      setCommandsLoading(false);
      if (toolMenuOpen && toolMenuLoadRef.current.openId === openId) setCommandsLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setCommandsLoading(true);
    void loadCommands()
      .then((next) => {
        if (!cancelled) {
          setCommands(next);
          if (toolMenuOpen && toolMenuLoadRef.current.openId === openId) setCommandsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommands([]);
          if (toolMenuOpen && toolMenuLoadRef.current.openId === openId) setCommandsLoaded(true);
        }
      })
      .finally(() => {
        if (!cancelled) setCommandsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slashOpen, toolMenuOpen, loadCommands]);

  useEffect(() => {
    if (!mentionOpen) return;
    let cancelled = false;
    void Promise.all([props.listAgents(), props.searchFiles(mentionQuery), listRunningAppsForMention()]).then(([agentList, files, apps]) => {
      if (cancelled) return;
      const recent = props.recentFiles.slice(0, 8);
      const codeItems = recent.map((file) => ({ id: `code:${file}`, kind: "code" as const, value: file, label: file.split(/[\\/]/).pop() || file, description: file }));
      const fileItems = [
        ...recent.map((file) => ({ id: `file:${file}`, kind: "file" as const, value: file, label: file })),
        ...files.filter((file) => !recent.includes(file)).map((file) => ({ id: `file:${file}`, kind: "file" as const, value: file, label: file })),
      ];
      const next: MentionItem[] = [
        ...agentList.map((agent) => ({ id: `agent:${agent.name}`, kind: "agent" as const, value: agent.name, label: agent.name })),
        // Code snippets (recent files) — offered alongside plain file refs.
        ...codeItems,
        ...fileItems,
        // Running macOS apps (Computer Use targets). Listed after files so an
        // empty "@" stays file-first; fuzzy search surfaces them as the user
        // types (e.g. "@mus" → Music).
        ...apps.map((appName) => ({ id: `app:${appName}`, kind: "app" as const, value: appName, label: appName })),
        // Enhanced mention types (docs, git, terminal, rules) from the provider.
        ...props.extraMentionItems ?? [],
      ];
      setMentionItems(next);
    }).catch(() => {
      if (!cancelled) setMentionItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [mentionOpen, mentionQuery, props.listAgents, props.recentFiles, props.searchFiles, props.extraMentionItems]);

  useEffect(() => {
    if (!toolMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolMenuRef.current?.contains(target)) return;
      setToolMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [toolMenuOpen]);

  useEffect(() => {
    if (!agentMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (agentMenuRef.current?.contains(target)) return;
      setAgentMenuOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [agentMenuOpen]);

  useEffect(() => {
    if (!toolMenuOpen) return;
    const openId = toolMenuLoadRef.current.openId;
    const listImportedPlugins = listImportedPluginsRef.current;
    if (listImportedPlugins && !toolMenuLoadRef.current.plugins) {
      let cancelled = false;
      toolMenuLoadRef.current.plugins = true;
      setPluginsLoading(true);
      void listImportedPlugins()
        .then((next) => {
          if (!cancelled && toolMenuLoadRef.current.openId === openId) {
            setImportedPlugins(next);
            setPluginsLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled && toolMenuLoadRef.current.openId === openId) {
            setImportedPlugins([]);
            setPluginsLoaded(true);
          }
        })
        .finally(() => {
          if (!cancelled && toolMenuLoadRef.current.openId === openId) setPluginsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [toolMenuOpen]);

  useEffect(() => {
    if (!slashOpen && !toolMenuOpen) return;
    const openId = toolMenuLoadRef.current.openId;
    const listMcp = listMcpRef.current;
    if ((slashOpen || toolMenuSection === "skills") && (!toolMenuOpen || !toolMenuLoadRef.current.skills)) {
      let cancelled = false;
      if (toolMenuOpen) toolMenuLoadRef.current.skills = true;
      setSkillsLoading(true);
      void loadSkills()
        .then((next) => {
          if (!cancelled && (!toolMenuOpen || toolMenuLoadRef.current.openId === openId)) {
            setSkills(next);
            setSkillsLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled && (!toolMenuOpen || toolMenuLoadRef.current.openId === openId)) {
            setSkills([]);
            setSkillsLoaded(true);
          }
        })
        .finally(() => {
          if (!cancelled && (!toolMenuOpen || toolMenuLoadRef.current.openId === openId)) setSkillsLoading(false);
        });
      return () => {
        cancelled = true;
        if (toolMenuOpen && toolMenuLoadRef.current.openId === openId) {
          toolMenuLoadRef.current.skills = false;
        }
      };
    }
    if ((toolMenuSection === "extensions" || toolMenuSection === "mcps") && listMcp && !toolMenuLoadRef.current.mcps) {
      let cancelled = false;
      toolMenuLoadRef.current.mcps = true;
      setMcpLoading(true);
      void listMcp()
        .then((next) => {
          if (cancelled || toolMenuLoadRef.current.openId !== openId) return;
          setMcpServers(next.servers);
          setMcpStatuses(next.statuses);
          setMcpStatus(next.status);
          setMcpLoaded(true);
        })
        .catch(() => {
          if (cancelled || toolMenuLoadRef.current.openId !== openId) return;
          setMcpServers([]);
          setMcpStatuses({});
          setMcpLoaded(true);
        })
        .finally(() => {
          if (!cancelled && toolMenuLoadRef.current.openId === openId) setMcpLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [loadSkills, slashOpen, toolMenuOpen, toolMenuSection]);

  // 智能体 / 连接器清单按段落懒加载：只在对应段落首次展开时拉一次。
  const capabilityLoadRef = useRef({ experts: false, connectors: false });
  useEffect(() => {
    if (!toolMenuOpen) return;
    if (toolMenuSection === "experts" && !capabilityLoadRef.current.experts) {
      capabilityLoadRef.current.experts = true;
      void fetchExperts();
    }
    if (toolMenuSection === "connectors" && !capabilityLoadRef.current.connectors) {
      capabilityLoadRef.current.connectors = true;
      void refreshConnectors();
    }
  }, [toolMenuOpen, toolMenuSection, fetchExperts, refreshConnectors]);

  const selectedExpert = selectedExpertId
    ? experts.find((expert) => expert.id === selectedExpertId) ?? null
    : null;
  const selectedConnectors = IM_CONNECTOR_DEFINITIONS.filter((definition) =>
    selectedConnectorIds.includes(definition.id),
  );

  const builtinGoalCommand = useMemo<ComposerSlashCommandOption>(
    () => ({ id: "builtin-goal", name: "goal", description: t("composer.goal_slash_desc"), source: "command" }),
    [],
  );
  const slashItems = useMemo<ComposerSlashCommandOption[]>(
    () => [builtinGoalCommand, ...commands, ...connectSkillSlashCommandOptions(skills)],
    [builtinGoalCommand, commands, skills],
  );
  const slashFiltered = useMemo(() => {
    if (!slashOpen) return [];
    if (!slashQuery) return slashItems.slice(0, 8);
    return fuzzysort.go(slashQuery, slashItems, { keys: ["name", "description"], limit: 8 }).map((entry) => entry.obj);
  }, [slashItems, slashOpen, slashQuery]);
  const mentionFiltered = useMemo(() => {
    if (!mentionOpen) return [];
    if (!mentionQuery) return mentionItems.slice(0, 8);
    return fuzzysort.go(mentionQuery, mentionItems, { keys: ["label"], limit: 8 }).map((entry) => entry.obj);
  }, [mentionItems, mentionOpen, mentionQuery]);
  const pastedTextTokens = useMemo(
    () => props.pastedText.map((item) => ({ label: item.label, lines: item.lines, text: item.text })),
    [props.pastedText],
  );

  const handleExpandPastedText = useCallback((label: string) => {
    const target = props.pastedText.find((item) => item.label === label);
    if (!target) return;
    props.onExpandPastedText(target.id);
  }, [props.onExpandPastedText, props.pastedText]);

  const activeMenu = slashOpen ? "slash" : mentionOpen ? "mention" : null;
  const activeItems = activeMenu === "slash" ? slashFiltered : activeMenu === "mention" ? mentionFiltered : [];
  const toolCommandItems = useMemo(
    () => [builtinGoalCommand, ...commands.filter((command) => !command.source || command.source === "command")],
    [builtinGoalCommand, commands],
  );
  const toolSkillItems = commands.filter((command) => command.source === "skill");
  const toolMcpItems = commands.filter((command) => command.source === "mcp");
  void toolMcpItems;
  const localCommandSkillNames = new Set(toolSkillItems.map((command) => command.name));
  const skillMenuItems: SkillCard[] = [
    ...toolSkillItems.map((command) => ({
      name: command.name,
      path: `command://${command.id}`,
      description: command.description,
      origin: "local" as const,
    })),
    ...skills.filter((skill) =>
      skill.origin === "openwork-connect" || !localCommandSkillNames.has(skill.name)
    ),
  ];
  const pluginSections = importedPlugins
    .filter((plugin) => plugin.files.length > 0)
    .map((plugin) => ({ section: `plugin:${plugin.pluginId}` as const, plugin }));
  const activePlugin = toolMenuSection.startsWith("plugin:")
    ? pluginSections.find((entry) => entry.section === toolMenuSection)?.plugin ?? null
    : null;
  const extensionCatalogPlatform = resolveOpenWorkExtensionCatalogPlatform(platform.platform, platform.os);
  const composerExtensions = filterOpenWorkExtensionCatalogForPlatform(OPENWORK_EXTENSION_CATALOG, extensionCatalogPlatform).filter((entry) =>
    !builtInExtensionsDisabled &&
    !isOpenWorkExtensionHidden(entry) && isComposerExtensionAvailable(entry)
  );
  const canSend = props.draft.trim().length > 0 || props.attachments.length > 0;

  useEffect(() => {
    if (!toolMenuSection.startsWith("plugin:")) return;
    if (activePlugin) return;
    setToolMenuSection("commands");
  }, [activePlugin, toolMenuSection]);

  useEffect(() => {
    if (!activeItems.length) {
      setMenuIndex(0);
      return;
    }
    setMenuIndex((current) => Math.max(0, Math.min(current, activeItems.length - 1)));
  }, [activeItems.length]);

  useEffect(() => {
    menuItemRefs.current.length = activeItems.length;
    const target = menuItemRefs.current[menuIndex];
    target?.scrollIntoView({ block: "nearest" });
  }, [menuIndex, activeItems.length]);

  const applyCommandSelection = (command: ComposerSlashCommandOption, options?: { replaceSkillDraft?: boolean }) => {
    if (command.skill) {
      applySkillSelection(command.skill, options);
      return;
    }
    if (command.source === "skill") {
      applySkillSelection(command.name, options);
      return;
    }
    props.onDraftChange(`/${command.name} `);
    setSlashOpen(false);
    setToolMenuOpen(false);
  };

  const applySkillSelection = (input: string | SkillCard, options?: { replaceSkillDraft?: boolean }) => {
    const skill = typeof input === "string"
      ? { name: input, path: "", origin: "local" as const }
      : input;
    if (skill.origin === "openwork-connect") {
      const slug = skillSlashCommandName(skill);
      const token = encodeConnectSkillToken({
        slug,
        name: skill.name,
        marketplace: skill.marketplaceName ?? "assigned",
        capability: skill.connectCapabilityName ?? skill.name,
      });
      if (options?.replaceSkillDraft) {
        props.onDraftChange(`${token} `);
      } else {
        const editor = editorRef.current;
        if (editor) {
          editor.insertSkillAtSelection(slug, token);
        } else {
          const separator = props.draft.length > 0 && !/\s$/.test(props.draft) ? " " : "";
          props.onDraftChange(`${props.draft}${separator}${token} `);
        }
      }
      setSlashOpen(false);
      setToolMenuOpen(false);
      return;
    }
    const name = skill.name;
    if (options?.replaceSkillDraft) {
      props.onDraftChange(`[skill ${name}] `);
    } else {
      const editor = editorRef.current;
      if (editor) {
        editor.insertSkillAtSelection(name);
      } else {
        const separator = props.draft.length > 0 && !/\s$/.test(props.draft) ? " " : "";
        props.onDraftChange(`${props.draft}${separator}[skill ${name}] `);
      }
    }
    setSlashOpen(false);
    setToolMenuOpen(false);
  };

  const applyPluginFileSelection = (file: CloudImportedPluginFile) => {
    const commandName = pluginSlashCommandName(file);
    if (commandName) {
      if (file.objectType === "skill") applySkillSelection(commandName);
      else applyCommandSelection({
        id: `plugin:${file.configObjectId}`,
        name: commandName,
        source: "command",
      });
      return;
    }
    props.onInsertMention("file", file.path);
    setToolMenuOpen(false);
  };

  const applyAgentSelection = (name: string | null) => {
    props.onSelectAgent(name);
    setAgentMenuOpen(false);
    setToolMenuOpen(false);
  };

  const applyExtensionSelection = (entry: McpDirectoryInfo) => {
    props.onDraftChange(entry.composerPrompt ?? `Use ${entry.name} to `);
    setToolMenuOpen(false);
  };

  // Configure lands on the matching OpenWork Extensions section: skills and
  // plugin tabs keep their scoped views, everything else opens the inventory.
  const openToolMenuSettings = () => {
    const section: ToolMenuSettingsSection =
      toolMenuSection === "commands" || toolMenuSection === "skills"
        ? toolMenuSection
        : toolMenuSection === "agents" || toolMenuSection === "extensions"
          ? "extensions"
          : "plugins";
    props.onOpenSettingsSection?.(section);
  };

  const acceptActiveItem = () => {
    if (!activeItems.length) return false;
    if (activeMenu === "slash") {
      const command = slashFiltered[menuIndex];
      if (!command) return false;
      applyCommandSelection(command, { replaceSkillDraft: true });
      return true;
    }
    if (activeMenu === "mention") {
      const item = mentionFiltered[menuIndex];
      if (!item) return false;
      props.onInsertMention(item.kind, item.value);
      setMentionOpen(false);
      return true;
    }
    return false;
  };

  // Listen for cross-app focus + draft flush events. The Solid shell uses
  // these from deep-link handlers, the command palette, and the browser
  // pagehide/beforeunload cycle so no in-flight draft is lost.
  useEffect(() => {
    const handleFocus = () => {
      const root = rootRef.current;
      if (!root) return;
      const editable = root.querySelector<HTMLElement>("[contenteditable='true']");
      editable?.focus();
    };
    const handleFlush = () => {
      // onDraftChange always runs synchronously on every keystroke, so this
      // listener is effectively a hook for the shell to signal "we're about
      // to unmount, commit any debounced state". Re-fire with the current
      // draft so downstream stores can checkpoint it.
      props.onDraftChange(draftRef.current);
    };
    window.addEventListener(FOCUS_PROMPT_EVENT, handleFocus);
    window.addEventListener(FLUSH_PROMPT_EVENT, handleFlush);
    window.addEventListener("beforeunload", handleFlush);
    window.addEventListener("pagehide", handleFlush);
    return () => {
      window.removeEventListener(FOCUS_PROMPT_EVENT, handleFocus);
      window.removeEventListener(FLUSH_PROMPT_EVENT, handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
      window.removeEventListener("pagehide", handleFlush);
    };
  }, [props.onDraftChange]);

  const handleKeyDownCapture: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    // IME composition guard — block Enter while IME is mid-character.
    const imeActive =
      imeComposingRef.current ||
      (event.nativeEvent as KeyboardEvent).isComposing === true ||
      event.keyCode === 229;
    if (event.key === "Enter" && imeActive) {
      return;
    }
    // Escape-to-stop while the agent is busy. Only when no menu is open so
    // Escape can still close menus. First press arms a confirmation prompt
    // for 3s; a second Escape within that window stops the agent.
    const anyMenuOpen = agentMenuOpen || toolMenuOpen || Boolean(activeMenu);
    if (event.key === "Escape" && props.busy && !anyMenuOpen) {
      event.preventDefault();
      if (escapeArmed) {
        disarmEscape();
        void props.onStop();
      } else {
        setEscapeArmed(true);
        if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
        escapeTimerRef.current = setTimeout(() => {
          setEscapeArmed(false);
          escapeTimerRef.current = null;
        }, 3000);
      }
      return;
    }
    if (agentMenuOpen) {
      const total = nonDefaultAgents.length + 1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setAgentMenuIndex((current) => (current + 1) % total);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setAgentMenuIndex((current) => (current - 1 + total) % total);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = agentMenuIndex === 0 ? null : nonDefaultAgents[agentMenuIndex - 1]?.name ?? null;
        props.onSelectAgent(selected);
        setAgentMenuOpen(false);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setAgentMenuOpen(false);
        return;
      }
    }

    if (toolMenuOpen && event.key === "Escape") {
      event.preventDefault();
      setToolMenuOpen(false);
      return;
    }

    // Input history recall (#2012). Only when no menu is consuming the
    // arrow keys and IME composition is not active.
    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      !imeActive &&
      !agentMenuOpen &&
      !toolMenuOpen &&
      (!activeMenu || !activeItems.length)
    ) {
      const history = props.inputHistory ?? [];
      const position = historyPosRef.current;
      if (event.key === "ArrowUp") {
        const startRecall = position === null && props.draft.trim() === "" && history.length > 0;
        const continueRecall = position !== null && position > 0;
        if (startRecall || continueRecall) {
          const nextPos = position === null ? history.length - 1 : position - 1;
          if (position === null) historyStashRef.current = props.draft;
          historyPosRef.current = nextPos;
          historyExpectedRef.current = history[nextPos];
          event.preventDefault();
          props.onDraftChange(history[nextPos]);
          return;
        }
      } else if (position !== null) {
        event.preventDefault();
        const nextPos = position + 1;
        if (nextPos >= history.length) {
          historyPosRef.current = null;
          historyExpectedRef.current = null;
          props.onDraftChange(historyStashRef.current);
        } else {
          historyPosRef.current = nextPos;
          historyExpectedRef.current = history[nextPos];
          props.onDraftChange(history[nextPos]);
        }
        return;
      }
    }

    if (!activeMenu || !activeItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMenuIndex((current) => (current + 1) % activeItems.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMenuIndex((current) => (current - 1 + activeItems.length) % activeItems.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      void acceptActiveItem();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSlashOpen(false);
      setMentionOpen(false);
    }
  };

  // Attachment chips are raw Lexical token DOM, so their uploading overlay is
  // synced by attribute whenever the uploading flag or the chip set changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    syncAttachmentChipStatus(root, props.attachmentsUploading ? "uploading" : "ready");
  }, [props.attachmentsUploading, props.attachments]);

  const addAttachments = async (inputFiles: File[]) => {
    if (!inputFiles.length) return;
    if (!props.attachmentsEnabled) {
      toast.warning(props.attachmentsDisabledReason ?? t("composer.attachments_unavailable"));
      return;
    }

    // No client-side size cap: oversized files are rejected upstream (upload
    // endpoint or provider) with their own errors instead of a composer rule.
    // Oversized images are compressed at send time (see image-compression.ts)
    // so the chip appears instantly instead of blocking on canvas work here.
    props.onAttachFiles(inputFiles);
  };

  const activeMcpItems = mcpServers.map((entry) => ({
    entry,
    status: toReactMcpStatus(entry.id ?? entry.name, entry, mcpStatuses),
  }));

  const panelRoundedClass =
    mentionOpen || slashOpen
      ? "rounded-t-[18px] border-t-transparent"
      : "";

  const renderSlashMenu = () => {
    if (!slashOpen) return null;
    return (
      <div className="absolute bottom-full left-[-1px] right-[-1px] z-30">
          <div className="overflow-hidden rounded-t-[20px] border border-dls-border border-b-0 bg-dls-surface shadow-[var(--dls-shell-shadow)]">
            <div
              role="presentation"
              className="max-h-64 overflow-y-auto p-2"
              onMouseDown={(event) => event.preventDefault()}
          >
            {slashFiltered.length > 0 ? (
              <div className="grid gap-1">
                {slashFiltered.map((command, index) => (
                  <button
                    key={command.id}
                    ref={(element) => {
                      menuItemRefs.current[index] = element;
                    }}
                    type="button"
                    className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-gray-2/70 ${activeMenu === "slash" && slashFiltered[menuIndex]?.id === command.id ? "bg-gray-3 text-gray-12" : "text-gray-11"}`}
                    onMouseEnter={() => setMenuIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      applyCommandSelection(command, { replaceSkillDraft: true });
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) applyCommandSelection(command, { replaceSkillDraft: true });
                    }}
                  >
                    <Terminal size={14} className="mt-0.5 shrink-0 text-gray-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-xs font-semibold">/{command.name}</div>
                        {command.source && command.source !== "command" ? (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${command.source === "skill" ? "bg-violet-3/40 text-violet-11" : "bg-cyan-3/40 text-cyan-11"}`}>
                            {command.source === "skill" ? t("composer.skill_source") : t("composer.mcps_label")}
                          </span>
                        ) : null}
                      </div>
                      {command.description ? <div className="truncate text-xs text-gray-10">{command.description}</div> : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-gray-10">
                {(!commandsLoaded && commandsLoading) || skillsLoading ? t("composer.loading_commands") : t("composer.no_commands")}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMentionIcon = (kind: ComposerMentionKind) => {
    const cls = "mt-0.5 shrink-0 text-gray-9";
    switch (kind) {
      case "agent":
        return <Zap size={14} className={cls} />;
      case "app":
        return <AppWindowMac size={14} className={cls} />;
      case "code":
        return <FileCode size={14} className={cls} />;
      case "docs":
        return <BookOpen size={14} className={cls} />;
      case "git":
        return <GitBranch size={14} className={cls} />;
      case "terminal":
        return <TerminalSquare size={14} className={cls} />;
      case "rules":
        return <ShieldCheck size={14} className={cls} />;
      default:
        return <FileText size={14} className={cls} />;
    }
  };

  const renderMentionKindLabel = (kind: ComposerMentionKind) => {
    switch (kind) {
      case "agent":
        return t("composer.agent_label");
      case "app":
        return t("composer.app_kind");
      case "code":
        return t("composer.code_kind");
      case "docs":
        return t("composer.docs_kind");
      case "git":
        return t("composer.git_kind");
      case "terminal":
        return t("composer.terminal_kind");
      case "rules":
        return t("composer.rules_kind");
      default:
        return t("composer.file_kind");
    }
  };

  const renderMentionMenu = () => {
    if (!mentionOpen || mentionFiltered.length === 0) return null;
    return (
      <div className="absolute bottom-full left-[-1px] right-[-1px] z-30">
          <div className="overflow-hidden rounded-t-[20px] border border-dls-border border-b-0 bg-dls-surface shadow-[var(--dls-shell-shadow)]">
            <div
              role="presentation"
              className="max-h-64 overflow-y-auto p-2"
              onMouseDown={(event) => event.preventDefault()}
          >
            <div className="grid gap-1">
              {mentionFiltered.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => {
                    menuItemRefs.current[index] = element;
                  }}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-gray-2/70 ${activeMenu === "mention" && mentionFiltered[menuIndex]?.id === item.id ? "bg-gray-3 text-gray-12" : "text-gray-11"}`}
                  onMouseEnter={() => setMenuIndex(index)}
                  onClick={() => {
                    props.onInsertMention(item.kind, item.value);
                    setMentionOpen(false);
                  }}
                >
                  {renderMentionIcon(item.kind)}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">@{item.label}</div>
                    <div className="truncate text-xs text-gray-10">
                      {item.description ?? renderMentionKindLabel(item.kind)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const contributionCtx: ComposerContributionContext = {
    draft: props.draft,
    setDraft: props.onDraftChange,
    busy: props.busy,
    disabled: props.disabled,
  };

  return (
    <div
      ref={rootRef}
      className={props.flush ? `relative ${toolMenuOpen ? "z-50" : "z-20"}` : `sticky bottom-0 ${toolMenuOpen ? "z-50" : "z-20"} bg-gradient-to-t from-dls-surface via-dls-surface/95 to-transparent px-4 pb-[max(0.5rem,calc(env(safe-area-inset-bottom)+var(--keyboard-inset,0px)))] max-lg:px-3 lg:px-8 ${props.compactTopSpacing ? "pt-0" : "pt-1"}`}
      style={{ contain: "layout style" }}
      onKeyDownCapture={handleKeyDownCapture}
      onCompositionStart={() => {
        imeComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        imeComposingRef.current = false;
      }}
    >
      <div className={props.flush ? "" : "max-w-[800px] mx-auto"}>
        {/* Main composer panel */}
        <div
          className={`relative overflow-visible rounded-[18px] border border-dls-border bg-dls-surface transition-all ${panelRoundedClass}`}
        >
          {props.topAccessory ? <div className="relative z-10">{props.topAccessory}</div> : null}

          {renderMentionMenu()}
          {renderSlashMenu()}

          {/*
            The pasted-text chip used to render twice — once inline inside
            the Lexical editor (via ComposerPastedTextNode) and again as a
            separate rail here above the composer. Keep only the inline
            chip; its pill already shows label + line count, and the user
            removes it with backspace like any other inline token.
          */}

          {dropzoneActive ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-[20px] border-2 border-dashed border-dls-accent bg-[color:color-mix(in_oklab,var(--dls-accent)_10%,transparent)]">
              <div className="rounded-2xl border border-dls-border bg-dls-surface/95 px-5 py-4 text-center backdrop-blur-sm">
                <div className="text-sm font-medium text-dls-text">{t("composer.attach_files")}</div>
                <div className="mt-1 text-xs text-dls-secondary">{t("composer.any_file_type_supported")}</div>
              </div>
            </div>
          ) : null}

          <div className="px-4 pt-3 pb-2">
            {/* Editor */}
            <LexicalPromptEditor
              ref={editorRef}
              value={props.draft}
              mentions={props.mentions}
              pastedText={pastedTextTokens}
              attachments={props.attachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                kind: isImageAttachment(attachment) ? "image" : "file",
                previewUrl: attachment.previewUrl,
              }))}
              disabled={props.disabled}
              placeholder={t("composer.placeholder")}
              onChange={props.onDraftChange}
              onSubmit={handleEditorSubmit}
              onExpandPastedText={handleExpandPastedText}
              onRemoveAttachment={props.onRemoveAttachment}
              onPasteText={props.onPasteText}
              onPaste={(event) => {
                // Paste policy:
                // 1. Actual files on the clipboard -> attach them.
                // 2. Explicit text/uri-list (drag from Finder / browser) -> insert links.
                // 3. Plain text -> DO NOTHING. Let Lexical's PlainTextPlugin
                //    handle the paste natively so newlines render correctly
                //    and no content is silently dropped. Previous behavior
                //    hijacked pastes that merely contained absolute paths
                //    like "/Users/..." or pastes longer than 10 lines, which
                //    was the root cause of "paste into composer is broken".
                const files = Array.from(event.clipboardData?.files ?? []);
                if (files.length) {
                  event.preventDefault();
                  void addAttachments(files);
                  return;
                }

                const uriList = event.clipboardData
                  ? parseClipboardUriList(event.clipboardData)
                  : [];
                if (uriList.length) {
                  event.preventDefault();
                  props.onUnsupportedFileLinks(uriList);
                  return;
                }

                const text = event.clipboardData?.getData("text/plain") ?? "";

                // Plain text paste display is owned by PasteChipPlugin inside
                // the Lexical editor: text collapses when it would exceed the
                // editor's current width and maximum height, unless the whole
                // string is a standalone HTTP(S) URL. Text that fits, or is
                // expanded from a chip, renders like normal text. Do NOT
                // duplicate that here.

                if (
                  text.trim() &&
                  (props.isRemoteWorkspace || props.isSandboxWorkspace) &&
                  /file:\/\/|(^|\s)\/(Users|home|var|etc|opt|tmp|private|Volumes|Applications)\//.test(text)
                ) {
                  const attachedFiles = props.attachments.map((attachment) => attachment.file);
                  toast.warning(t("composer.remote_worker_paste_warning"), {
                    action:
                      props.onUploadInboxFiles && attachedFiles.length > 0
                        ? {
                            label: t("composer.upload_to_shared_folder"),
                            onClick: () => void props.onUploadInboxFiles?.(attachedFiles),
                          }
                        : undefined,
                  });
                  // Intentionally no preventDefault — the notice is advisory,
                  // the paste still goes through the editor.
                }
              }}
              onDragOver={(event) => {
                if (event.dataTransfer?.files?.length) {
                  event.preventDefault();
                  if (!dropzoneActive) setDropzoneActive(true);
                }
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                setDropzoneActive(false);
              }}
              onDrop={(event) => {
                const files = Array.from(event.dataTransfer?.files ?? []);
                setDropzoneActive(false);
                if (!files.length) return;
                event.preventDefault();
                void addAttachments(files);
              }}
            />

            {/* Action row — attachments, quick actions, model controls, and send */}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-2 max-lg:gap-y-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <input
                  ref={(element) => {
                    fileInput = element ?? undefined;
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    if (files.length) void addAttachments(files);
                    event.currentTarget.value = "";
                  }}
                />
                <div
                  ref={toolMenuRef}
                  className="relative"
                  onMouseDown={(event) => {
                    const target = event.target;
                    if (target instanceof Element && target.closest("button")) event.preventDefault();
                  }}
                >
                  <button
                    type="button"
                    className={`inline-flex h-9 max-h-9 w-9 items-center justify-center rounded-full transition-colors max-lg:h-11 max-lg:max-h-11 max-lg:w-11 ${toolMenuOpen ? "bg-gray-3 text-gray-12" : "text-gray-10 hover:bg-gray-3"}`}
                    onClick={() => {
                      setMentionOpen(false);
                      setMentionItems([]);
                      setSlashOpen(false);
                      setToolMenuOpen((value) => !value);
                    }}
                    aria-expanded={toolMenuOpen}
                    aria-haspopup="dialog"
                    title={t("composer.add_label")}
                  >
                    <Plus size={16} />
                  </button>
                  {toolMenuOpen ? (
                    <div className="absolute bottom-full left-0 z-40 mb-3 w-[min(calc(100vw-2.5rem),34rem)] overflow-hidden rounded-[22px] border border-dls-border bg-dls-surface shadow-[var(--dls-shell-shadow)]">
                      <div className="grid grid-cols-[152px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)]">
                        <div className="border-r border-dls-border bg-gray-2/30 p-2">
                          <button
                            type="button"
                            className={`mb-1 flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left text-sm transition-colors ${
                              props.attachmentsEnabled ? "text-gray-11 hover:bg-gray-2" : "cursor-not-allowed text-gray-9 opacity-60"
                            }`}
                            onClick={() => {
                              if (!props.attachmentsEnabled) return;
                              setToolMenuOpen(false);
                              fileInput?.click();
                            }}
                            disabled={!props.attachmentsEnabled}
                            title={props.attachmentsDisabledReason ?? t("composer.attach_menu_item")}
                          >
                            <Paperclip size={14} className="shrink-0 text-gray-9" />
                            <span className="truncate">{t("composer.attach_menu_item")}</span>
                          </button>
                          {props.onRecordScreen && isScreenRecordingSupported(navigator) ? (
                            <button
                              type="button"
                              data-composer-record-screen
                              className="mb-1 flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left text-sm text-gray-11 transition-colors hover:bg-gray-2"
                              onClick={() => {
                                setToolMenuOpen(false);
                                props.onRecordScreen?.();
                              }}
                              title={t("composer.record_screen_hint")}
                            >
                              <Video size={14} className="shrink-0 text-gray-9" />
                              <span className="truncate">{t("composer.record_screen")}</span>
                            </button>
                          ) : null}
                          <div className="my-2 border-t border-dls-border" />
                          {([
                            ["experts", t("composer.experts_label")],
                            ["skills", t("dashboard.skills")],
                            ["connectors", t("composer.connectors_label")],
                            ["commands", t("dashboard.commands")],
                            ["extensions", t("composer.library_label")],
                            ["agents", t("composer.agents_label")],
                          ] as const).map(([section, label]) => (
                            <button
                              key={section}
                              type="button"
                              className={`mb-1 flex w-full items-center justify-between rounded-[16px] px-3 py-2.5 text-left text-sm transition-colors ${toolMenuSection === section ? "bg-gray-3 text-gray-12" : "text-gray-11 hover:bg-gray-2"}`}
                              onClick={() => setToolMenuSection(section)}
                            >
                              <span className="truncate">{label}</span>
                              <ChevronRight size={14} className="shrink-0 text-gray-9" />
                            </button>
                          ))}
                          {pluginSections.length > 0 ? <div className="my-2 border-t border-dls-border" /> : null}
                          {pluginSections.map(({ section, plugin }) => (
                            <button
                              key={plugin.pluginId}
                              type="button"
                              className={`mb-1 flex w-full items-center justify-between rounded-[16px] px-3 py-2.5 text-left text-sm transition-colors ${toolMenuSection === section ? "bg-gray-3 text-gray-12" : "text-gray-11 hover:bg-gray-2"}`}
                              onClick={() => setToolMenuSection(section)}
                            >
                              <span className="truncate">{plugin.name}</span>
                              <ChevronRight size={14} className="shrink-0 text-gray-9" />
                            </button>
                          ))}
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          <div className="mb-2 flex justify-end gap-2 border-b border-dls-border px-1 pb-2">
                            {toolMenuSection === "experts" || toolMenuSection === "connectors" ? (
                              <button
                                type="button"
                                data-capability-manager={toolMenuSection}
                                className="inline-flex items-center gap-1.5 rounded-full border border-dls-border px-3 py-1.5 text-[12px] font-medium text-gray-11 transition-colors hover:bg-gray-2"
                                onClick={() => {
                                  setToolMenuOpen(false);
                                  props.onOpenCapabilityManager?.(toolMenuSection);
                                }}
                              >
                                <Settings size={12} />
                                {toolMenuSection === "experts"
                                  ? t("composer.manage_experts")
                                  : t("composer.manage_connectors")}
                              </button>
                            ) : null}
                            {toolMenuSection !== "experts" && toolMenuSection !== "connectors" ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-full border border-dls-border px-3 py-1.5 text-[12px] font-medium text-gray-11 transition-colors hover:bg-gray-2"
                                onClick={() => {
                                  setToolMenuOpen(false);
                                  openToolMenuSettings();
                                }}
                              >
                                <Settings size={12} />
                                {t("composer.configure")}
                              </button>
                            ) : null}
                          </div>
                          {toolMenuSection === "experts" ? (
                            experts.length > 0 ? (
                              <div className="grid gap-1" data-tool-menu-section="experts">
                                {experts.map((expert) => {
                                  const active = selectedExpertId === expert.id;
                                  return (
                                    <button
                                      key={expert.id}
                                      type="button"
                                      data-expert-id={expert.id}
                                      className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-gray-2/70 ${active ? "bg-gray-2 text-gray-12" : "text-gray-11"}`}
                                      onClick={() => {
                                        setCapabilityExpert(active ? null : expert.id);
                                        setToolMenuOpen(false);
                                      }}
                                    >
                                      <Bot size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold text-gray-11">{expert.name}</div>
                                        {expert.description ? <div className="truncate text-xs text-gray-10">{expert.description}</div> : null}
                                        {expert.skills.length > 0 ? (
                                          <div className="truncate text-[10px] text-gray-9">
                                            {t("composer.expert_skill_count", { count: String(expert.skills.length) })}
                                          </div>
                                        ) : null}
                                      </div>
                                      {active ? <Check size={14} className="mt-0.5 shrink-0 text-gray-10" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-gray-10">{t("composer.no_experts")}</div>
                            )
                          ) : null}
                          {toolMenuSection === "connectors" ? (
                            <div className="grid gap-1" data-tool-menu-section="connectors">
                              {IM_CONNECTOR_DEFINITIONS.map((definition) => {
                                const state = connectorStates.find((entry) => entry.id === definition.id);
                                const isConnected = state?.status === "connected";
                                const selected = selectedConnectorIds.includes(definition.id);
                                const Icon = definition.icon;
                                return (
                                  <button
                                    key={definition.id}
                                    type="button"
                                    data-connector-id={definition.id}
                                    disabled={!isConnected}
                                    title={isConnected ? undefined : t("composer.connector_not_connected")}
                                    className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors ${
                                      isConnected ? "hover:bg-gray-2/70" : "cursor-not-allowed opacity-55"
                                    } ${selected && isConnected ? "bg-gray-2 text-gray-12" : "text-gray-11"}`}
                                    onClick={() => {
                                      if (!isConnected) return;
                                      toggleCapabilityConnector(definition.id);
                                    }}
                                  >
                                    <Icon className="mt-0.5 size-3.5 shrink-0 text-gray-9" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-11">{definition.name}</div>
                                        <span
                                          className={cn(
                                            "size-1.5 shrink-0 rounded-full",
                                            state?.status === "connected"
                                              ? "bg-emerald-500"
                                              : state?.status === "connecting"
                                                ? "bg-amber-500"
                                                : "bg-muted-foreground",
                                          )}
                                        />
                                      </div>
                                      <div className="truncate text-[10px] text-gray-9">
                                        {isConnected ? t("composer.connector_connected") : t("composer.connector_not_connected")}
                                      </div>
                                    </div>
                                    {selected && isConnected ? <Check size={14} className="mt-0.5 shrink-0 text-gray-10" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          {toolMenuSection === "agents" ? (
                            <div className="grid gap-1">
                              <button
                                type="button"
                                className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-gray-2/70 ${props.selectedAgent === null ? "bg-gray-2 text-gray-12" : "text-gray-11"}`}
                                onClick={() => applyAgentSelection(null)}
                              >
                                <Zap size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                <div className="min-w-0 flex-1 truncate text-xs font-semibold">{t("composer.default_agent")}</div>
                                {props.selectedAgent === null ? <Check size={14} className="mt-0.5 shrink-0 text-gray-10" /> : null}
                              </button>
                              {nonDefaultAgents.map((agent) => {
                                const active = props.selectedAgent === agent.name;
                                return (
                                  <button
                                    key={agent.name}
                                    type="button"
                                    className={`flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-gray-2/70 ${active ? "bg-gray-2 text-gray-12" : "text-gray-11"}`}
                                    onClick={() => applyAgentSelection(agent.name)}
                                  >
                                    <Zap size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-semibold">{agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}</div>
                                      {agent.description ? <div className="truncate text-xs text-gray-10">{agent.description}</div> : null}
                                    </div>
                                    {active ? <Check size={14} className="mt-0.5 shrink-0 text-gray-10" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          {toolMenuSection === "commands" ? (
                            toolCommandItems.length > 0 ? (
                              <div className="grid gap-1">
                                {toolCommandItems.map((command) => (
                                  <button
                                    key={command.id}
                                    type="button"
                                    className="flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left text-gray-11 transition-colors hover:bg-gray-2/70"
                                    onClick={() => applyCommandSelection(command)}
                                  >
                                    <Terminal size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-semibold text-gray-11">/{command.name}</div>
                                      {command.description ? <div className="truncate text-xs text-gray-10">{command.description}</div> : null}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-gray-10">
                                {!commandsLoaded && commandsLoading ? t("composer.loading_commands") : t("composer.no_commands")}
                              </div>
                            )
                          ) : null}
                          {toolMenuSection === "skills" ? (
                            skillMenuItems.length > 0 ? (
                              <div className="grid gap-1">
                                {skillMenuItems.map((skill) => (
                                  <button
                                    key={`${skill.origin ?? "local"}:${skill.path || skill.name}`}
                                    type="button"
                                    className="flex min-w-0 w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left text-gray-11 transition-colors hover:bg-gray-2/70"
                                    onClick={() => applySkillSelection(skill)}
                                  >
                                    <Zap size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-11">
                                          /{skillMenuSlashCommandName(skill)}
                                        </div>
                                        {isLocalCapability(skill.origin) ? (
                                          <span className="shrink-0 rounded-full bg-gray-3 px-2 py-0.5 text-[10px] font-medium text-gray-11">
                                            {t("composer.source_local")}
                                          </span>
                                        ) : null}
                                      </div>
                                      {skill.description ? <div className="truncate text-xs text-gray-10">{skill.description}</div> : null}
                                      {skill.origin === "openwork-connect" ? (
                                        <div className="truncate text-[10px] text-gray-9">
                                          {[skill.marketplaceName, skill.pluginName].filter(Boolean).join(" · ")}
                                        </div>
                                      ) : null}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-gray-10">
                                {(!skillsLoaded && skillsLoading) || (!commandsLoaded && commandsLoading) ? t("composer.loading_commands") : t("context_panel.no_skills")}
                              </div>
                            )
                          ) : null}
                          {toolMenuSection === "extensions" ? (
                            <>
                              {composerExtensions.length > 0 ? (
                                <div className="grid gap-1">
                                  {composerExtensions.map((entry) => (
                                    <button
                                      key={entry.id ?? entry.serverName ?? entry.name}
                                      type="button"
                                      className="flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left text-gray-11 transition-colors hover:bg-gray-2/70"
                                      onClick={() => applyExtensionSelection(entry)}
                                    >
                                      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-white shadow-sm">
                                        {extensionIcon(entry, 16)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="truncate text-xs font-semibold text-gray-11">{entry.name}</div>
                                          {entry.defaultEnabled ? (
                                            <span className="shrink-0 rounded-full bg-green-3 px-2 py-0.5 text-[10px] font-medium text-green-11">Enabled</span>
                                          ) : null}
                                        </div>
                                        <div className="truncate text-xs text-gray-10">{entry.description}</div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {activeMcpItems.length > 0 ? (
                                <div className={`grid gap-1 ${composerExtensions.length > 0 ? "mt-2 border-t border-dls-border pt-2" : ""}`}>
                                  {activeMcpItems.map(({ entry, status }) => (
                                    <div key={entry.id ?? entry.name} className="flex items-start gap-3 rounded-[16px] px-3 py-2.5 text-gray-11">
                                      <Plug size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="truncate text-xs font-semibold text-gray-11">{entry.name}</div>
                                          <div className="flex shrink-0 items-center gap-1">
                                            {isLocalCapability(entry.origin) ? (
                                              <span className="rounded-full bg-gray-3 px-2 py-0.5 text-[10px] font-medium text-gray-11">
                                                {t("composer.source_local")}
                                              </span>
                                            ) : null}
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mcpStatusBadgeClass(status)}`}>
                                              {formatMcpStatusLabel(status)}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="truncate text-xs text-gray-10">
                                          {entry.origin === "openwork-connect"
                                            ? [entry.marketplaceName, entry.pluginName].filter(Boolean).join(" · ")
                                              || entry.config.url
                                              || "Remote app"
                                            : entry.config.type === "remote"
                                              ? entry.config.url ?? entry.config.command?.join(" ") ?? "Remote app"
                                              : entry.config.command?.join(" ") ?? "Local app"}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {composerExtensions.length === 0 && activeMcpItems.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-10">
                                  {!mcpLoaded && mcpLoading
                                    ? t("composer.loading_commands")
                                    : (mcpStatus ?? "No library items enabled. Open Library to enable them.")}
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {activePlugin ? (
                            activePlugin.files.length > 0 ? (
                              <div className="grid gap-1">
                                {activePlugin.files.map((file) => (
                                  <button
                                    key={`${file.configObjectId}:${file.path}`}
                                    type="button"
                                    className="flex w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left text-gray-11 transition-colors hover:bg-gray-2/70"
                                    onClick={() => applyPluginFileSelection(file)}
                                  >
                                    <FileText size={14} className="mt-0.5 shrink-0 text-gray-9" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="truncate text-xs font-semibold text-gray-11">{file.title}</div>
                                        <span className="shrink-0 rounded-full bg-gray-3 px-2 py-0.5 text-[10px] font-medium text-gray-11">
                                          {formatPluginObjectType(file.objectType)}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-gray-10">No plugin files imported yet.</div>
                            )
                          ) : toolMenuSection.startsWith("plugin:") ? (
                            <div className="px-3 py-2 text-xs text-gray-10">
                              {!pluginsLoaded && pluginsLoading ? t("composer.loading_commands") : "Plugin files are unavailable."}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {getComposerActions("leading").map((action) => (
                  <Fragment key={action.id}>{action.render(contributionCtx)}</Fragment>
                ))}

                {/* Agent picker (#2101/#1971). Shows the active agent and lets
                    the user switch without leaving the composer. The same
                    selection is reachable from the plug menu, the command
                    palette ("Switch agent"), and @agent mentions. */}
                <div ref={agentMenuRef} className={showAgentPicker ? "relative" : "hidden"}>
                  <button
                    type="button"
                    className="flex h-9 max-h-9 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-gray-10 transition-colors hover:bg-gray-3 hover:text-gray-12"
                    onClick={() => setAgentMenuOpen((value) => !value)}
                    disabled={props.busy}
                    aria-expanded={agentMenuOpen}
                    title={t("composer.agent_label")}
                  >
                    <span className="max-w-[140px] truncate">{props.agentLabel}</span>
                    <ChevronDown size={13} />
                  </button>
                  {agentMenuOpen ? (
                    <div className="absolute left-0 bottom-full z-40 mb-2 w-64 overflow-hidden rounded-[18px] border border-dls-border bg-dls-surface shadow-[var(--dls-shell-shadow)]">
                      <div className="border-b border-dls-border px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-10">
                        {t("composer.agent_label")}
                      </div>
                      <div
                        role="presentation"
                        className="max-h-64 space-y-1 overflow-y-auto p-2"
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        <button
                          ref={(element) => {
                            agentItemRefs.current[0] = element;
                          }}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${!props.selectedAgent || agentMenuIndex === 0 ? "bg-gray-2 text-gray-12" : "text-gray-11 hover:bg-gray-2/70"}`}
                          onMouseEnter={() => setAgentMenuIndex(0)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applyAgentSelection(null);
                          }}
                        >
                          <span>{t("composer.default_agent")}</span>
                          {!props.selectedAgent ? <Check size={14} className="text-gray-10" /> : null}
                        </button>
                        {nonDefaultAgents.map((agent, index) => {
                          const active = props.selectedAgent === agent.name;
                          return (
                            <button
                              key={agent.name}
                              ref={(element) => {
                                agentItemRefs.current[index + 1] = element;
                              }}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${active || agentMenuIndex === index + 1 ? "bg-gray-2 text-gray-12" : "text-gray-11 hover:bg-gray-2/70"}`}
                              onMouseEnter={() => setAgentMenuIndex(index + 1)}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyAgentSelection(agent.name);
                              }}
                            >
                              <span className="truncate">{agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}</span>
                              {active ? <Check size={14} className="text-gray-10" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <WorkspaceSelect
                  label={props.workspaceLabel}
                  options={props.workspaceOptions}
                  onSelect={props.onWorkspaceSelect}
                  onCreate={props.onOpenCreateWorkspace}
                  disabled={props.steering}
                />

                <PermissionModeToggle
                  value={props.permissionMode}
                  onChange={props.onPermissionModeChange}
                  disabled={props.steering}
                />

                <ModelSelect
                  open={props.modelPickerOpen}
                  value={props.selectedModel}
                  hideValue={props.organizationModelsEmpty}
                  onOpenChange={props.onModelPickerOpenChange}
                  onChange={(model) => {
                    if (!props.steering) props.onModelChange(model);
                  }}
                  disabled={props.steering}
                  sessionId={props.sessionId}
                  agentId={props.agentIsCli ? props.selectedAgent : null}
                  agentDefaultModel={props.agentDefaultModel}
                  openWorkModelsEntitled={props.openWorkModelsEntitled}
                  openWorkModelsSyncing={props.openWorkModelsSyncing}
                  fallbackOptions={props.modelOptions}
                />
                {props.modelUnavailable ? props.onRefreshOrganizationModels ? (
                  <button
                    type="button"
                    className="inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-red-5 bg-red-2 px-2.5 text-[11px] font-medium text-red-11 transition-colors hover:border-red-6 hover:bg-red-3 disabled:cursor-wait disabled:opacity-70 sm:max-w-80"
                    onClick={() => void handleRefreshOrganizationModels()}
                    disabled={refreshingOrganizationModels}
                    title={t("models.refresh_organization_models")}
                  >
                    <span className="min-w-0 truncate">
                      {props.modelUnavailableMessage ?? t("models.model_unavailable_short")}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <RefreshCw size={11} className={refreshingOrganizationModels ? "animate-spin" : ""} />
                      {refreshingOrganizationModels ? t("models.refreshing_organization_models") : t("models.retry_organization_models")}
                    </span>
                  </button>
                ) : (
                  <span className="max-w-[20rem] truncate text-xs font-medium text-red-10">
                    {props.modelUnavailableMessage ?? t("models.model_unavailable_short")}
                  </span>
                ) : null}

                <ModelBehaviorSelect
                  value={props.modelVariant}
                  label={props.modelVariantLabel}
                  options={props.modelBehaviorOptions}
                  onChange={(value) => {
                    if (!props.steering) props.onModelVariantChange(value);
                  }}
                  disabled={props.steering}
                />
              </div>

              <div
                aria-hidden="true"
                className="mx-1 h-6 w-px shrink-0 bg-dls-border max-lg:hidden"
              />

              {/*
                Action area.
                - Idle: single "Run task" button (sends immediately).
                - Busy: an outline "Stop" on the left (kept apart from the
                  send cluster), then a split send button — the primary
                  segment sends now (the agent adjusts mid-task, aka
                  "steer"; Enter does the same), and the chevron opens a
                  menu with "Send when agent finishes" (queue, ⌘⏎). A badge
                  on the chevron shows how many messages are queued.
                  Escape arms a "Hit Escape again to stop the agent" prompt.
              */}
              <div className="ml-auto flex shrink-0 items-end gap-1.5 max-lg:w-full max-lg:justify-end">
                {/* Inline voice input - WorkBuddy-style */}
                {props.voiceInputSupported ? (
                  <button
                    type="button"
                    onClick={props.onVoiceInput}
                    className={`inline-flex h-9 max-h-9 w-9 items-center justify-center rounded-full border transition-colors max-lg:h-11 max-lg:max-h-11 ${
                      props.voiceInputActive
                        ? "border-red-4 bg-red-2 text-red-11"
                        : "border-dls-border bg-transparent text-gray-11 hover:bg-gray-3"
                    }`}
                    aria-label={t("composer.voice_input")}
                    title={props.voiceInputActive ? t("composer.voice_input_listening") : t("composer.voice_input")}
                  >
                    <Mic size={14} />
                  </button>
                ) : null}

                {/* Quick codex-style action toggles: loop / watch / site / record */}
                {QUICK_COMMAND_DEFINITIONS.map((def) => (
                  <QuickActionButton key={def.id} mode={def.id} />
                ))}

                {props.busy ? (
                  <>
                    {escapeArmed ? (
                      <span className="self-center pr-1 text-[12px] font-medium text-gray-10 max-lg:hidden">
                        {t("composer.escape_to_stop")}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={props.onStop}
                      className="mr-2 inline-flex h-9 max-h-9 items-center gap-2 rounded-full border border-dls-border bg-transparent px-4 text-[13px] font-medium text-gray-11 transition-colors hover:bg-gray-3 max-lg:h-11 max-lg:max-h-11"
                      title={t("composer.stop")}
                    >
                      <Square size={12} fill="currentColor" />
                      <span>{t("composer.stop")}</span>
                    </button>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={canSend ? props.onSteer : undefined}
                        disabled={!canSend}
                        className={`inline-flex h-9 max-h-9 items-center gap-2 rounded-l-full pl-4 pr-3 text-[13px] font-medium transition-colors max-lg:h-11 max-lg:max-h-11 ${
                          canSend
                            ? "bg-[var(--dls-accent)] text-[var(--dls-accent-fg)] hover:bg-[var(--dls-accent-hover)]"
                            : "bg-gray-4 text-gray-10"
                        }`}
                        title={t("composer.steer_hint")}
                      >
                        <Zap size={14} />
                        <span>{t("composer.steer")}</span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={t("composer.send_options")}
                              className={`relative inline-flex h-9 max-h-9 items-center rounded-r-full border-l pl-1.5 pr-2.5 transition-colors max-lg:h-11 max-lg:max-h-11 ${
                                canSend
                                  ? "border-[color-mix(in_srgb,var(--dls-accent-fg)_25%,transparent)] bg-[var(--dls-accent)] text-[var(--dls-accent-fg)] hover:bg-[var(--dls-accent-hover)]"
                                  : "border-gray-6 bg-gray-4 text-gray-10"
                              }`}
                            >
                              <ChevronDown size={14} />
                              {props.queuedCount > 0 ? (
                                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-12 px-1 text-[10px] font-semibold text-gray-1">
                                  {props.queuedCount}
                                </span>
                              ) : null}
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canSend}
                            onClick={() => void props.onQueue()}
                            title={t("composer.queue_hint")}
                          >
                            <ListPlus size={14} />
                            <span>
                              {props.queuedCount > 0
                                ? `${t("composer.queue")} · ${t("composer.queued_count", { count: props.queuedCount })}`
                                : t("composer.queue")}
                            </span>
                            <DropdownMenuShortcut>{isMacPlatform() ? "⌘⏎" : "Ctrl+⏎"}</DropdownMenuShortcut>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={canSend && !props.submissionPreparing ? props.onSend : undefined}
                    disabled={props.disabled || !canSend || props.submissionPreparing}
                    aria-label={props.submissionPreparing ? "Preparing connected service tools…" : t("composer.run_task")}
                    title={props.submissionPreparing ? "Preparing connected service tools…" : t("composer.run_task")}
                    className={`inline-flex h-9 w-9 max-h-9 items-center justify-center rounded-full transition-colors max-lg:h-11 max-lg:w-11 max-lg:max-h-11 ${
                      !canSend || props.disabled || props.submissionPreparing
                        ? "bg-gray-4 text-gray-10"
                        : "bg-[var(--dls-accent)] text-[var(--dls-accent-fg)] hover:bg-[var(--dls-accent-hover)]"
                    }`}
                  >
                    {props.submissionPreparing ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WorkBuddy 对标：已引用的智能体 / 连接器以芯片展示——hero 与会话内都要显示，
            因为它描述的是「这条提示词会带上什么」，而非页面提示。 */}
        {selectedExpertId || selectedConnectorIds.length > 0 || sessionGoal || Object.values(activeQuickCommands).some(Boolean) ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            data-composer-capability-chips
          >
            {sessionGoal ? (
              <button
                type="button"
                data-capability-chip="goal"
                data-goal-status={sessionGoal.status}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-dls-border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  goalChipClass(sessionGoal.status),
                  "hover:bg-gray-3",
                )}
                onClick={() => props.sessionId && clearSessionGoal(props.sessionId)}
                title={t("composer.goal_chip_title")}
              >
                <Target size={11} className="shrink-0" />
                <span className="truncate">{sessionGoal.objective}</span>
                <span className="shrink-0 tabular-nums opacity-70">{formatGoalProgress(sessionGoal)}</span>
                <X size={11} className="shrink-0 text-gray-9" />
              </button>
            ) : null}
            {QUICK_COMMAND_DEFINITIONS.map((def) => {
              const isActive = activeQuickCommands[def.id];
              if (!isActive) return null;
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              const IconComp = def.icon as React.ComponentType<{ className?: string; size?: number }>;
              return (
                <button
                  key={def.id}
                  type="button"
                  data-capability-chip={`quick_cmd:${def.id}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  onClick={() => useQuickCommandsStore.getState().toggle(def.id)}
                  title={t(def.labelKey)}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {IconComp ? <IconComp size={11} /> : null}
                  <span className="truncate">{t(def.labelKey)}</span>
                  <X size={11} className="shrink-0 text-blue-400" />
                </button>
              );
            })}
            {selectedExpert ? (
              <button
                type="button"
                data-capability-chip="expert"
                className="inline-flex items-center gap-1.5 rounded-full border border-dls-border bg-gray-2 px-2.5 py-1 text-[11px] font-medium text-gray-12 transition-colors hover:bg-gray-3"
                onClick={() => setCapabilityExpert(null)}
                title={t("composer.remove_capability")}
              >
                <Bot size={11} className="shrink-0" />
                <span className="truncate">{selectedExpert.name}</span>
                <X size={11} className="shrink-0 text-gray-9" />
              </button>
            ) : null}
            {selectedConnectors.map((definition) => {
              const Icon = definition.icon;
              return (
                <button
                  key={definition.id}
                  type="button"
                  data-capability-chip={definition.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dls-border bg-gray-2 px-2.5 py-1 text-[11px] font-medium text-gray-12 transition-colors hover:bg-gray-3"
                  onClick={() => toggleCapabilityConnector(definition.id)}
                  title={t("composer.remove_capability")}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate">{definition.name}</span>
                  <X size={11} className="shrink-0 text-gray-9" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
