/**
 * CLI Agent Session Bridge
 *
 * 解决：UI 在 agent 选择器中选中 CLI agent（kimi / claude-code / codex / goose ...）
 * 后，prompt 会被原样转发给 opencode sidecar → opencode 不认识该 agent →
 * UnknownError（SessionPrompt.createUserMessage 抛错）。
 *
 * 方案：在 server 层拦截 prompt_async。当 body.agent 命中 CLI preset（RuntimeRegistry
 * 检测可用）时：
 *   - 不走 opencode 代理，而是通过 agent-sidecar 真实启动 CLI 进程执行 prompt
 *     （ACP / PTY / headless 由 createAdapterForAgent + runAgentPrompt 统一路由）；
 *   - 执行结果（user + assistant 消息）写入本模块的内存 store；
 *   - 后续 session 读取（GET session / messages / snapshot）也从 store 返回，
 *     使 UI 的 transcript 正常渲染（UI 通过 snapshot 轮询刷新，staleTime=500ms）。
 *
 * 消息/会话格式对齐 opencode read model（session-read-model.ts）：
 *   - SessionInfoReadModel: { id, title, time, ... }
 *   - SessionMessageReadModel: { info: { id, sessionID, role, parentID, time }, parts: [...] }
 *   - SessionSnapshotReadModel: { session, messages, todos, status }
 */

import { randomUUID } from "node:crypto";
import { runAgentPrompt } from "./agent-team/agent-runner.js";
import { createAdapterForAgent, type CreateAdapterForAgentOptions } from "./agent-sidecar/registry.js";
import { AGENT_PRESETS, selectPresetForAgent, DEFAULT_PROTOCOL_PREFERENCE } from "./agent-sidecar/presets.js";
import { GenericCliSidecarAdapter } from "./agent-sidecar/cli-adapter/generic-cli.js";
import { restoreRealHomeEnv } from "./agent-sidecar/home-env.js";
import { getGlobalSidecarPool } from "./agent-sidecar/sidecar-pool.js";
import type { AgentSidecarAdapter } from "./agent-sidecar/types.js";
import type { SessionSnapshotReadModel } from "./session-read-model.js";

// ============================================================
// 类型
// ============================================================

export interface CliStoredPart {
  id: string;
  messageID: string;
  sessionID: string;
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface CliStoredMessage {
  info: {
    id: string;
    sessionID: string;
    role: string;
    parentID: string | null;
    /** 产生该消息的 CLI agent（多 agent 同窗口会话中用于归属与线程串联） */
    agent: string;
    time: { created: number; completed?: number };
  };
  parts: CliStoredPart[];
}

export interface CliSessionRecord {
  workspaceId: string;
  sessionId: string;
  /** 首个参与会话的 agent（主 agent，用于会话列表展示） */
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 正在执行的 agent 集合 —— 同窗口内多个 CLI agent 可并行运行 */
  runningAgents: Set<string>;
  /** 每个 agent 最近一次失败的原始错误 */
  agentErrors: Record<string, string>;
  messages: CliStoredMessage[];
}

export interface RunCliPromptInput {
  workspaceId: string;
  sessionId: string;
  agentId: string;
  title?: string;
  prompt: string;
  cwd: string;
}

export type RunCliPromptResult = { ok: true } | { ok: false; error: string };

// ============================================================
// 内存 store（进程内；server 重启即清空，与 opencode session 生命周期解耦）
// ============================================================

const sessions = new Map<string, CliSessionRecord>();

const keyOf = (workspaceId: string, sessionId: string) => `${workspaceId}:${sessionId}`;

function getOrCreate(input: RunCliPromptInput): CliSessionRecord {
  const key = keyOf(input.workspaceId, input.sessionId);
  const existing = sessions.get(key);
  if (existing) return existing;
  const record: CliSessionRecord = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    title: input.title?.trim() || promptTitle(input.prompt),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    runningAgents: new Set<string>(),
    agentErrors: {},
    messages: [],
  };
  sessions.set(key, record);
  return record;
}

function promptTitle(prompt: string): string {
  const firstLine = prompt.split(/\r?\n/, 1)[0]?.trim() || prompt.slice(0, 80);
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

/**
 * 多 agent 同窗口会话的 parent 解析：优先串联到同一 agent 自己的最后一条消息，
 * 使各 agent 的线程互不干扰；该 agent 尚无消息时回落到全局最后一条消息。
 */
export function resolveParentId(record: Pick<CliSessionRecord, "messages">, agentId: string): string | null {
  for (let index = record.messages.length - 1; index >= 0; index -= 1) {
    const message = record.messages[index];
    if (message.info.agent === agentId) return message.info.id;
  }
  return record.messages.length > 0 ? record.messages[record.messages.length - 1].info.id : null;
}

function buildMessage(role: string, text: string, sessionId: string, parentID: string | null, agent: string): CliStoredMessage {
  const id = `cli_${randomUUID().replace(/-/g, "")}`;
  const now = Date.now();
  return {
    info: {
      id,
      sessionID: sessionId,
      role,
      parentID,
      agent,
      time: { created: now, completed: now },
    },
    parts: [
      {
        id: `part_${randomUUID().replace(/-/g, "")}`,
        messageID: id,
        sessionID: sessionId,
        type: "text",
        text,
      },
    ],
  };
}

// ============================================================
// 执行
// ============================================================

interface AttemptResult {
  ok: boolean;
  text: string;
  thinking: string;
  error: string;
  protocol: string;
}

/** 流式输出块：thinking = agent-thought-chunk（ACP 思考流），text = agent-message-chunk */
interface AttemptChunk {
  kind: "text" | "thinking";
  text: string;
}

/**
 * 单次执行尝试（一个协议选择）。结构化协议（acp/http）走进程池复用；
 * pty/generic（含 headless-oneshot）由 stream() 自行 spawn，无需池。
 *
 * onChunk 在每次文本块到达时同步回调，供调用方边执行边把增量写入
 * store —— 这样 UI 通过 snapshot 轮询就能实时看到 thinking/回答，
 * 而不是等完整执行结束才一次性出现。
 */
async function attemptRun(
  input: RunCliPromptInput,
  choice: (typeof DEFAULT_PROTOCOL_PREFERENCE)[number] | undefined,
  onChunk?: (chunk: AttemptChunk) => void,
): Promise<AttemptResult> {
  let adapter: AgentSidecarAdapter;
  let protocolLabel = "none";
  // 恢复真实 HOME（Electron dev 隔离）供 CLI agent 读取登录态/配置
  const homeOverride = restoreRealHomeEnv();
  try {
    if (choice === "headless-oneshot") {
      // registry 的 "pty" 注册的是 PtySidecarAdapter（无 stream），headless 一次性执行
      // 必须直接用 GenericCliSidecarAdapter（kimi -p / claude -p ...）
      const preset = AGENT_PRESETS[input.agentId];
      if (!preset) {
        return { ok: false, text: "", thinking: "", error: `agent '${input.agentId}' 无 preset`, protocol: "headless-oneshot" };
      }
      adapter = new GenericCliSidecarAdapter({
        agentId: input.agentId,
        protocol: "generic",
        binary: preset.binary ?? "",
        binaryPath: preset.binaryPath,
        args: preset.args,
        outputParser: preset.outputParser,
        cliProfile: preset.cliProfile,
        env: { ...preset.env, ...homeOverride },
        cwd: preset.cwd,
      });
      protocolLabel = "headless-oneshot";
    } else {
      const preset = AGENT_PRESETS[input.agentId];
      // 合并 preset.env + 真实 HOME（overrides.env 会整体替换 config.env）
      const mergedEnv = { ...preset?.env, ...homeOverride };
      const overrides: CreateAdapterForAgentOptions | undefined =
        choice === "pty"
          ? { protocol: "pty", executionMode: "persistent-pty", overrides: { env: mergedEnv } }
          : choice === "acp"
            ? { protocol: "acp", overrides: { env: mergedEnv } }
            : choice === "http"
              ? { protocol: "http", overrides: { env: mergedEnv } }
              : undefined;
      adapter = createAdapterForAgent(input.agentId, overrides);
      protocolLabel = adapter.protocol;
    }
  } catch (err) {
    return { ok: false, text: "", thinking: "", error: `创建 adapter 失败: ${err instanceof Error ? err.message : String(err)}`, protocol: protocolLabel };
  }

  const protocol = protocolLabel;
  const isStructured = protocol === "acp" || protocol === "http";
  const run = async (execAdapter: AgentSidecarAdapter): Promise<{ text: string; thinking: string; error: string }> => {
    const chunks: string[] = [];
    const thinkingChunks: string[] = [];
    let errorText = "";
    try {
      for await (const event of runAgentPrompt({
        adapter: execAdapter,
        cwd: input.cwd,
        prompt: input.prompt,
        timeoutMs: 0,
      })) {
        if (event.kind === "agent-message-chunk") {
          chunks.push(event.text);
          onChunk?.({ kind: "text", text: event.text });
        } else if (event.kind === "agent-thought-chunk") {
          thinkingChunks.push(event.text);
          onChunk?.({ kind: "thinking", text: event.text });
        } else if (event.kind === "error") {
          errorText = event.error;
        }
      }
    } catch (err) {
      errorText = err instanceof Error ? err.message : String(err);
    }
    return { text: chunks.join(""), thinking: thinkingChunks.join(""), error: errorText };
  };

  const isSuccess = (result: { text: string; thinking: string; error: string }): boolean =>
    result.text.trim().length > 0 && !result.error;

  if (isStructured) {
    const pool = getGlobalSidecarPool();
    let handle: Awaited<ReturnType<typeof pool.acquire>>;
    try {
      handle = await pool.acquire(adapter, { cwd: input.cwd, timeoutMs: 20_000 }, {
        keyFn: () => `cli:${input.agentId}:${input.cwd}`,
      });
    } catch (err) {
      return { ok: false, text: "", thinking: "", error: `启动 CLI agent '${input.agentId}' 失败: ${err instanceof Error ? err.message : String(err)}`, protocol };
    }
    try {
      const { text, thinking, error } = await run(handle.adapter);
      return { ok: isSuccess({ text, thinking, error }), text, thinking, error, protocol };
    } finally {
      await pool.release(handle).catch(() => {});
    }
  }

  const { text, thinking, error } = await run(adapter);
  return { ok: isSuccess({ text, thinking, error }), text, thinking, error, protocol };
}

/**
 * 流式累积 assistant 消息的 reasoning/text parts：thinking 块进 reasoning part，
 * 文本块进 text part。同一类型只有一份 part，边执行边累加，供 snapshot 轮询实时展示。
 */
export function upsertAssistantChunk(message: CliStoredMessage, kind: "text" | "thinking", text: string) {
  const type = kind === "thinking" ? "reasoning" : "text";
  let part = message.parts.find((candidate) => candidate.type === type);
  if (!part) {
    part = {
      id: `part_${randomUUID().replace(/-/g, "")}`,
      messageID: message.info.id,
      sessionID: message.info.sessionID,
      type,
      text: "",
    };
    message.parts.push(part);
  }
  part.text = (part.text ?? "") + text;
}

/** 标记 assistant 消息完成（执行中 chunk 已把文本累积进 parts，这里只需补完成时间） */
function finalizeAssistant(message: CliStoredMessage) {
  message.info.time = { created: message.info.time.created, completed: Date.now() };
}

/**
 * 真实执行 CLI agent prompt（带协议降级链）。
 *
 * 按 preset.preferProtocolOrder 依次尝试：acp → headless-oneshot → pty。
 * - kimi：ACP 因认证/启动失败时，自动降级 headless-oneshot（`kimi -p <prompt>`，
 *   使用设备登录凭据，实测可用）
 * - 每次尝试通过 createAdapterForAgent 选择对应协议 adapter，runAgentPrompt() 统一执行
 * - 结果写回 store；调用方（prompt_async 拦截）在收到 204 时即可从 snapshot 读到完整会话
 *
 * 流式：assistant 消息在开始执行时就占位写入 store（reasoning/text parts 随执行
 * 增量累积），UI 通过 snapshot 轮询可实时看到 thinking 与回答，而不是等完整执行
 * 结束才一次性出现。每次新的协议尝试会重置 assistant parts（避免降级时残留上一
 * 尝试的部分输出）。
 */
export async function runCliAgentPrompt(input: RunCliPromptInput): Promise<RunCliPromptResult> {
  const record = getOrCreate(input);
  record.runningAgents.add(input.agentId);
  delete record.agentErrors[input.agentId];
  record.title = record.title || promptTitle(input.prompt);
  // 多 agent 同窗口会话：同一 agent 的回合串联到该 agent 自己的最后一条消息，
  // 使各 agent 的线程互不干扰（并行运行时仍各自独立成链）。
  const parentId = resolveParentId(record, input.agentId);
  record.messages.push(buildMessage("user", input.prompt, record.sessionId, parentId, input.agentId));
  // assistant 消息占位：执行中增量累积 reasoning/text，完成后定型。
  // parent 指向刚写入的 user 消息，保证线程串联不回落到其它 agent。
  const assistant: CliStoredMessage = {
    info: {
      id: `cli_${randomUUID().replace(/-/g, "")}`,
      sessionID: record.sessionId,
      role: "assistant",
      parentID: record.messages[record.messages.length - 1]?.info.id ?? null,
      agent: input.agentId,
      time: { created: Date.now() },
    },
    parts: [],
  };
  record.messages.push(assistant);
  record.updatedAt = Date.now();

  const preset = selectPresetForAgent(input.agentId);
  const order = preset.preferProtocolOrder?.length ? preset.preferProtocolOrder : DEFAULT_PROTOCOL_PREFERENCE;

  let lastError = "";
  const attempted = new Set<string>();
  for (const choice of order) {
    // 新尝试：重置 assistant parts（降级时不留上一尝试的部分输出）
    assistant.parts = [];
    const t0 = Date.now();
    const attempt = await attemptRun(input, choice, (chunk) => {
      upsertAssistantChunk(assistant, chunk.kind, chunk.text);
      record.updatedAt = Date.now();
    });
    // eslint-disable-next-line no-console
    console.log(`[cli-agent] attempt: agent=${input.agentId} choice=${choice} -> protocol=${attempt.protocol} ok=${attempt.ok} textLen=${attempt.text.length} thinkingLen=${attempt.thinking.length} err=${attempt.error.slice(0, 200)} elapsed=${Date.now() - t0}ms`);
    // 相同协议只尝试一次（避免选择器回落到 base 造成重复 ACP 尝试）
    if (attempted.has(attempt.protocol)) continue;
    attempted.add(attempt.protocol);

    if (attempt.ok) {
      finalizeAssistant(assistant);
      record.runningAgents.delete(input.agentId);
      record.updatedAt = Date.now();
      return { ok: true };
    }
    lastError = attempt.error;
  }

  // 全部协议尝试失败：把占位的 assistant 消息替换为错误说明。
  // 多 agent 并行时其它 agent 的消息可能已 push 到末尾，必须按 id 定位本消息，
  // 不能按 `length - 1` 索引（否则会误覆盖别的 agent 的消息）。
  const assistantIndex = record.messages.findIndex((message) => message.info.id === assistant.info.id);
  if (assistantIndex >= 0) {
    record.messages[assistantIndex] = buildMessage(
      "assistant",
      `[CLI agent '${input.agentId}' 执行失败] ${lastError}`,
      record.sessionId,
      parentId,
      input.agentId,
    );
  }
  record.runningAgents.delete(input.agentId);
  record.agentErrors[input.agentId] = lastError;
  record.updatedAt = Date.now();
  return { ok: false, error: lastError };
}

// ============================================================
// 读取（供 sessions.ts 路由拦截）
// ============================================================

export function isCliSession(workspaceId: string, sessionId: string): boolean {
  return sessions.has(keyOf(workspaceId, sessionId));
}

export function getCliSessionRecord(workspaceId: string, sessionId: string): CliSessionRecord | undefined {
  return sessions.get(keyOf(workspaceId, sessionId));
}

export function deleteCliSession(workspaceId: string, sessionId: string): void {
  sessions.delete(keyOf(workspaceId, sessionId));
}

/** opencode SessionInfoReadModel 形状（附多 agent 元数据供前端展示/并行发送判断） */
export function buildCliSessionInfo(record: CliSessionRecord) {
  const participants = [...new Set(record.messages.map((message) => message.info.agent).filter(Boolean))];
  return {
    id: record.sessionId,
    title: record.title || null,
    agent: record.agentId,
    time: { created: record.createdAt, updated: record.updatedAt },
    summary: {},
    metadata: {
      cli: true,
      agents: participants,
      runningAgents: [...record.runningAgents],
    },
  };
}

/** opencode SessionMessageReadModel[] 形状（含最新 limit 条） */
export function buildCliSessionMessages(record: CliSessionRecord, limit?: number) {
  const messages = typeof limit === "number" && limit > 0 ? record.messages.slice(-limit) : record.messages;
  return messages.map((message) => ({
    info: message.info,
    parts: message.parts,
  }));
}

/** opencode SessionSnapshotReadModel 形状 */
export function buildCliSessionSnapshot(record: CliSessionRecord): SessionSnapshotReadModel {
  return {
    session: buildCliSessionInfo(record),
    messages: buildCliSessionMessages(record),
    todos: [],
    status: record.runningAgents.size > 0 ? { type: "busy" } : { type: "idle" },
  };
}

/** 校验 agentId 是否是 CLI preset（供 prompt_async 拦截判断；二进制可用性由调用方校验） */
export function isCliAgentId(agentId: string): boolean {
  if (!agentId) return false;
  // opencode 内建 agent（build/plan 等）走原代理
  if (agentId === "build" || agentId === "plan") return false;
  return Boolean(AGENT_PRESETS[agentId]);
}
