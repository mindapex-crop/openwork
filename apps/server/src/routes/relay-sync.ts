/**
 * Relay Sync（接力同步）REST API。
 *
 * - GET  /api/relay-sync/:threadId/status    双方版本 / 待同步队列
 * - GET  /api/relay-sync/:threadId/snapshot  生成 transcript 快照（含版本号，
 *                                            增量 turns 进入 outgoing pending）
 * - POST /api/relay-sync/:threadId/snapshot  应用对端快照（合并 / 冲突检测）
 * - GET  /api/relay-sync/:threadId/changes?from=  增量变更拉取
 * - POST /api/relay-sync/:threadId/relay     发起接力（云下→云上，标注 relay 事件）
 */

import { ApiError } from "../errors.js";
import { openRuntimeSqliteDatabase, runtimeDbPath } from "../runtime-db.js";
import { toTranscript } from "@openwork/headless-threads";
import { RelaySyncService } from "../relay-sync/service.js";
import { SqliteRelaySyncStore } from "../relay-sync/store.js";
import type {
  RelayEntryRecord,
  RelaySnapshotInput,
  RelayTranscriptSnapshot,
} from "../relay-sync/types.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import type { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;
type WorkspaceOpencodeClient = ReturnType<typeof createOpencodeClient>;
type OpencodeClientResult<T, E> =
  | { data: T | undefined; error: undefined; response: Response }
  | { data: undefined; error: E; response: Response };
type UnwrapOpencodeResult = <T, E>(result: OpencodeClientResult<T, E>, path: string) => NonNullable<T>;

export interface RegisterRelaySyncRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  parseOptionalNonNegativeInteger: (value: string | null, name: string) => number | undefined;
  createWorkspaceOpencodeClient: (
    config: ServerConfig,
    workspace: WorkspaceInfo,
    options?: { boundedDiagnosticsReads?: boolean; sessionId?: string },
  ) => WorkspaceOpencodeClient;
  resolveWorkspace: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
  unwrapOpencodeResult: UnwrapOpencodeResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** 校验并归一化 POST /snapshot 的 body 为 RelaySnapshotInput。 */
function parseSnapshotInput(threadId: string, body: Record<string, unknown>): RelaySnapshotInput {
  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new ApiError(400, "invalid_payload", "snapshot.version must be a non-negative integer");
  }
  const messages = body.messages;
  if (!Array.isArray(messages)) {
    throw new ApiError(400, "invalid_payload", "snapshot.messages must be an array");
  }
  const parsedMessages: RelaySnapshotInput["messages"] = [];
  for (const message of messages) {
    if (!isRecord(message)) {
      throw new ApiError(400, "invalid_payload", "snapshot.messages entries must be objects");
    }
    const id = typeof message.id === "string" && message.id.trim() ? message.id.trim() : "";
    if (!id) {
      throw new ApiError(400, "invalid_payload", "snapshot.messages entries require a non-empty id");
    }
    const role = typeof message.role === "string" ? message.role : "user";
    const createdAt = typeof message.createdAt === "number" ? message.createdAt : null;
    const text = typeof message.text === "string" ? message.text : "";
    const reasoning = typeof message.reasoning === "string" ? message.reasoning : "";
    const toolCalls = Array.isArray(message.toolCalls)
      ? message.toolCalls.flatMap((call) => {
          if (!isRecord(call)) return [];
          const partId = typeof call.partId === "string" ? call.partId : "";
          if (!partId) return [];
          return [{
            partId,
            name: typeof call.name === "string" ? call.name : "",
            callId: typeof call.callId === "string" ? call.callId : null,
            status: typeof call.status === "string" ? call.status : null,
          }];
        })
      : [];
    parsedMessages.push({ id, role, createdAt, text, reasoning, toolCalls });
  }
  return {
    threadId,
    version,
    title: readOptionalString(body.title),
    status: isRecord(body.status) ? (body.status as RelaySnapshotInput["status"]) : { type: "idle" },
    messages: parsedMessages,
    finalAssistantText: typeof body.finalAssistantText === "string" ? body.finalAssistantText : "",
    usage: isRecord(body.usage) ? (body.usage as unknown as RelaySnapshotInput["usage"]) : undefined,
    terminalError: isRecord(body.terminalError) ? (body.terminalError as unknown as RelaySnapshotInput["terminalError"]) : null,
    source: readOptionalString(body.source) ?? undefined,
    createdAt: typeof body.createdAt === "number" ? body.createdAt : undefined,
  };
}

/** 把 opencode session snapshot 组装成 relay readTranscript 需要的 transcript。 */
function assembleTranscript(input: {
  threadId: string;
  item: {
    session: { id: string; title?: string | null; directory?: string | null };
    messages: Array<{
      info: {
        id: string;
        role: string;
        parentID?: string | null;
        time?: { created?: number };
      };
      parts: Array<Record<string, unknown>>;
    }>;
    todos: Array<{ content: string; status: string; priority: string }>;
    status: unknown;
  };
}): ReturnType<typeof toTranscript> {
  const messages = input.item.messages.map((message) => ({
    id: message.info.id,
    role: message.info.role,
    parentId: message.info.parentID ?? null,
    createdAt: message.info.time?.created ?? null,
    error: null,
    usage: null,
    parts: message.parts.map((part) => {
      const mapped: { id: string; type?: string; text?: string; tool?: string; callId?: string; toolStatus?: string; synthetic?: boolean; ignored?: boolean } = {
        id: typeof part.id === "string" ? part.id : "",
      };
      if (typeof part.type === "string") mapped.type = part.type;
      if (typeof part.text === "string") mapped.text = part.text;
      if (typeof part.tool === "string") mapped.tool = part.tool;
      if (typeof part.callID === "string") mapped.callId = part.callID;
      if (isRecord(part.state) && typeof part.state.status === "string") mapped.toolStatus = part.state.status;
      if (part.synthetic === true) mapped.synthetic = true;
      if (part.ignored === true) mapped.ignored = true;
      return mapped;
    }),
  }));
  return toTranscript({
    threadId: input.threadId,
    title: input.item.session.title ?? null,
    directory: input.item.session.directory ?? null,
    status: isRecord(input.item.status) ? input.item.status as never : { type: "idle" },
    messages,
    todos: input.item.todos.map((todo) => ({ content: todo.content, status: todo.status, priority: todo.priority })),
  });
}

export function registerRelaySyncRoutes(options: RegisterRelaySyncRoutesOptions): void {
  const {
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable,
    requireClientScope,
    parseOptionalNonNegativeInteger,
    createWorkspaceOpencodeClient,
    resolveWorkspace,
    unwrapOpencodeResult,
  } = options;

  let servicePromise: Promise<RelaySyncService> | null = null;
  async function getService(): Promise<RelaySyncService> {
    if (servicePromise) return servicePromise;
    servicePromise = (async () => {
      const runtime = await openRuntimeSqliteDatabase(runtimeDbPath(config));
      const store = new SqliteRelaySyncStore(runtime);
      return new RelaySyncService({
        store,
        source: "local",
        readTranscript: async (threadId) => {
          const workspace = await resolveWorkspace(config, config.workspaces[0]?.id ?? "default");
          const opencode = createWorkspaceOpencodeClient(config, workspace, { sessionId: threadId });
          const encodedId = encodeURIComponent(threadId);
          const [session, messages, todos, statuses] = await Promise.all([
            opencode.session
              .get({ sessionID: threadId })
              .then((result) => unwrapOpencodeResult(result, `/session/${encodedId}`)),
            opencode.session
              .messages({ sessionID: threadId })
              .then((result) => unwrapOpencodeResult(result, `/session/${encodedId}/message`)),
            opencode.session
              .todo({ sessionID: threadId })
              .then((result) => unwrapOpencodeResult(result, `/session/${encodedId}/todo`)),
            opencode.session.status().then((result) => unwrapOpencodeResult(result, "/session/status")),
          ]);
          return assembleTranscript({
            threadId,
            item: {
              session,
              messages,
              todos,
              status: isRecord(statuses) ? (statuses[threadId] ?? { type: "idle" }) : { type: "idle" },
            },
          });
        },
      });
    })();
    return servicePromise;
  }

  addRoute(routes, "GET", "/api/relay-sync/:threadId/status", "client", async (ctx) => {
    const service = await getService();
    return jsonResponse(service.syncStatus(ctx.params.threadId ?? ""));
  });

  addRoute(routes, "GET", "/api/relay-sync/:threadId/snapshot", "client", async (ctx) => {
    const service = await getService();
    const snapshot = await service.threadSnapshot(ctx.params.threadId ?? "");
    return jsonResponse(snapshot satisfies RelayTranscriptSnapshot);
  });

  addRoute(routes, "POST", "/api/relay-sync/:threadId/snapshot", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const threadId = ctx.params.threadId ?? "";
    const body = await readJsonBody(ctx.request);
    const snapshot = parseSnapshotInput(threadId, body);
    const service = await getService();
    const result = service.applySnapshot(threadId, snapshot);
    if (!result.accepted && result.staleConflict) {
      return jsonResponse({ ...result, code: "relay_sync_stale_snapshot" }, 409);
    }
    return jsonResponse(result);
  });

  addRoute(routes, "GET", "/api/relay-sync/:threadId/changes", "client", async (ctx) => {
    const threadId = ctx.params.threadId ?? "";
    const fromVersion = parseOptionalNonNegativeInteger(ctx.url.searchParams.get("from"), "from") ?? 0;
    const service = await getService();
    const items = service.changeLog(threadId, fromVersion) satisfies RelayEntryRecord[];
    return jsonResponse({ threadId, fromVersion, items });
  });

  addRoute(routes, "POST", "/api/relay-sync/:threadId/relay", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const threadId = ctx.params.threadId ?? "";
    const body = await readJsonBody(ctx.request);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    const service = await getService();
    return jsonResponse(service.relay(threadId, { note: note ?? undefined }));
  });
}
