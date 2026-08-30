/**
 * 与服务端 HTTP JSON 契约对齐的类型定义。
 *
 * 对照服务端（apps/server）：
 * - SessionInfoReadModel / SessionMessageReadModel：apps/server/src/session-read-model.ts
 * - ExpertDefinition：apps/server/src/experts/types.ts
 * - WorkspaceInfo：apps/server/src/workspaces.ts
 *
 * 服务端契约（无统一 /api 前缀，usage 除外）：
 * - GET  /experts                          → { experts: Expert[] }
 * - GET  /experts/:id                      → Expert
 * - GET  /workspaces                       → { items, workspaces, activeId }
 * - GET  /workspace/:id/sessions           → { items: SessionInfo[] }
 * - POST /workspace/:id/sessions           → 201 { item, started }
 * - GET  /workspace/:id/sessions/:sid      → { item: SessionInfo }
 * - GET  /workspace/:id/sessions/:sid/messages → { items: SessionMessage[] }
 * - POST /workspace/:id/opencode/session/:sid/prompt_async（发送消息，联调待确认）
 * - GET  /chat/channels                    → { channels: string[] }
 * - GET  /api/usage/summary                → 用量汇总（client 鉴权）
 */

// ---------------------------------------------------------------------------
// 会话（对齐 session-read-model.ts 的 read-model）
// ---------------------------------------------------------------------------

export interface SessionTime {
  created?: number;
  updated?: number;
  completed?: number;
  archived?: number;
  [key: string]: unknown;
}

export interface SessionSummary {
  additions?: number;
  deletions?: number;
  files?: number;
  [key: string]: unknown;
}

/** 会话摘要（GET /workspace/:id/sessions 列表项 / 单个会话） */
export interface SessionInfo {
  id: string;
  title: string | null;
  slug?: string | null;
  parentID?: string | null;
  directory?: string | null;
  time?: SessionTime;
  summary?: SessionSummary;
  [key: string]: unknown;
}

/** 消息 part（opencode part：text / tool / reasoning 等，宽松建模） */
export interface SessionPart {
  id: string;
  messageID: string;
  sessionID: string;
  type?: string;
  text?: string;
  [key: string]: unknown;
}

export interface SessionMessageInfo {
  id: string;
  sessionID: string;
  role: string;
  parentID?: string | null;
  time?: SessionTime;
  [key: string]: unknown;
}

/** 会话消息（GET /workspace/:id/sessions/:sid/messages 列表项） */
export interface SessionMessage {
  info: SessionMessageInfo;
  parts: SessionPart[];
}

/** 会话状态（snapshot 用，宽松建模） */
export type SessionStatus =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number };

// ---------------------------------------------------------------------------
// 专家（对齐 experts/types.ts 的 ExpertDefinition）
// ---------------------------------------------------------------------------

export type ExpertSource = "local" | "builtin";
export type MemberRole = string;

export interface Expert {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  methodology: string;
  skills: string[];
  model?: string;
  avatar?: string;
  agentId: string;
  role?: MemberRole;
  createdAt: string;
  updatedAt: string;
  source: ExpertSource;
  path?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 工作区 / 连接器 / 用量
// ---------------------------------------------------------------------------

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  displayName?: string | null;
  workspaceType?: string;
  remoteType?: string | null;
  preset?: string;
  baseUrl?: string | null;
  [key: string]: unknown;
}

export interface WorkspacesResponse {
  items: WorkspaceInfo[];
  workspaces: WorkspaceInfo[];
  activeId: string | null;
}

export interface ChatChannelsResponse {
  channels: string[];
}

export interface UsageSummary {
  // 字段随服务端 /api/usage/summary 扩展，宽松建模
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 项目 / 自动化（移动端 mock 数据模型；服务端暂无 HTTP API，TODO 联调）
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
  status: "active" | "archived";
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  updatedAt: number;
}
