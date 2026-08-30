/**
 * 多设备远程控制 REST API。
 *
 * - POST   /api/devices/pair-code                桌面端生成配对码
 * - GET    /api/devices/pair-code                查询当前配对码（桌面端轮询）
 * - POST   /api/devices/pair                     移动端提交配对码完成配对
 * - GET    /api/devices                          列出已配对设备
 * - DELETE /api/devices/:deviceId                解绑设备
 * - POST   /api/devices/:deviceId/heartbeat      设备心跳上报
 * - POST   /api/devices/:deviceId/control        下发远程控制指令
 * - GET    /api/devices/:deviceId/control        拉取待执行控制指令
 * - POST   /api/devices/:deviceId/control/ack    确认控制指令已执行
 */

import { ApiError } from "../errors.js";
import { openRuntimeSqliteDatabase, runtimeDbPath } from "../runtime-db.js";
import { createDeviceService, DeviceServiceError } from "../devices/device-service.js";
import { SqliteDeviceStore } from "../devices/device-store.js";
import type { DeviceService } from "../devices/device-service.js";
import type { ServerConfig, TokenScope } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

export interface RegisterDeviceRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function registerDeviceRoutes(options: RegisterDeviceRoutesOptions): void {
  const { routes, config, jsonResponse, readJsonBody, ensureWritable, requireClientScope } = options;

  let servicePromise: Promise<DeviceService> | null = null;
  async function getService(): Promise<DeviceService> {
    if (servicePromise) return servicePromise;
    servicePromise = (async () => {
      const runtime = await openRuntimeSqliteDatabase(runtimeDbPath(config));
      const store = new SqliteDeviceStore(runtime);
      return createDeviceService(store);
    })();
    return servicePromise;
  }

  function wrapDeviceError(error: unknown): Response {
    if (error instanceof DeviceServiceError) {
      return jsonResponse({ code: error.code, message: error.message }, 400);
    }
    if (error instanceof ApiError) {
      return jsonResponse({ code: error.code, message: error.message }, error.status);
    }
    throw error;
  }

  addRoute(routes, "POST", "/api/devices/pair-code", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const service = await getService();
    const code = service.issuePairCode(Date.now());
    return jsonResponse({ pairCode: code, expiresInSeconds: 60 });
  });

  addRoute(routes, "GET", "/api/devices/pair-code", "client", async (ctx) => {
    requireClientScope(ctx, "owner");
    const service = await getService();
    const pending = service.getPendingPairCode();
    if (!pending || pending.consumed) {
      return jsonResponse({ pairCode: null });
    }
    const remaining = Math.max(0, pending.expiresAt - Date.now());
    return jsonResponse({ pairCode: pending.code, expiresInSeconds: Math.ceil(remaining / 1000) });
  });

  addRoute(routes, "POST", "/api/devices/pair", "client", async (ctx) => {
    ensureWritable(config);
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const result = service.pair(
        {
          pairCode: readString(body.pairCode),
          name: readString(body.name),
          platform: readString(body.platform) as "ios" | "android" | "web" | "desktop",
        },
        Date.now(),
      );
      return jsonResponse(result);
    } catch (error) {
      return wrapDeviceError(error);
    }
  });

  addRoute(routes, "GET", "/api/devices", "client", async (ctx) => {
    requireClientScope(ctx, "owner");
    const service = await getService();
    return jsonResponse({ devices: service.listDevices() });
  });

  addRoute(routes, "DELETE", "/api/devices/:deviceId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const deviceId = ctx.params.deviceId ?? "";
    const service = await getService();
    const revoked = service.revokeDevice(deviceId);
    if (!revoked) {
      return jsonResponse({ code: "device_not_found", message: "Device not found." }, 404);
    }
    return jsonResponse({ revoked: true, deviceId });
  });

  addRoute(routes, "POST", "/api/devices/:deviceId/heartbeat", "client", async (ctx) => {
    ensureWritable(config);
    const deviceId = ctx.params.deviceId ?? "";
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(ctx.request);
    } catch {
      body = {};
    }
    const service = await getService();
    const remoteControlActive = isRecord(body) && typeof body.remoteControlActive === "boolean"
      ? body.remoteControlActive
      : undefined;
    const ok = service.heartbeat(deviceId, Date.now(), remoteControlActive);
    if (!ok) {
      return jsonResponse({ code: "device_not_found", message: "Device not found." }, 404);
    }
    return jsonResponse({ ok: true });
  });

  addRoute(routes, "POST", "/api/devices/:deviceId/control", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const deviceId = ctx.params.deviceId ?? "";
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const record = service.enqueueControl(
        deviceId,
        {
          command: readString(body.command) as "continue" | "stop" | "lock" | "unlock",
          threadId: typeof body.threadId === "string" ? body.threadId : undefined,
          note: typeof body.note === "string" ? body.note : undefined,
        },
        Date.now(),
      );
      return jsonResponse(record);
    } catch (error) {
      return wrapDeviceError(error);
    }
  });

  addRoute(routes, "GET", "/api/devices/:deviceId/control", "client", async (ctx) => {
    const deviceId = ctx.params.deviceId ?? "";
    const service = await getService();
    const pending = service.pendingControl(deviceId);
    return jsonResponse({ command: pending });
  });

  addRoute(routes, "GET", "/api/devices/control/pending", "client", async (ctx) => {
    requireClientScope(ctx, "owner");
    const service = await getService();
    return jsonResponse({ commands: service.pendingControlAll() });
  });

  addRoute(routes, "POST", "/api/devices/:deviceId/control/ack", "client", async (ctx) => {
    ensureWritable(config);
    const deviceId = ctx.params.deviceId ?? "";
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    const commandId = readString(body.commandId);
    const status = readString(body.status) as "executed" | "failed";
    if (!commandId || (status !== "executed" && status !== "failed")) {
      return jsonResponse({ code: "invalid_payload", message: "commandId and status are required." }, 400);
    }
    const ok = service.ackControl({ commandId, status, executedAt: Date.now() });
    if (!ok) {
      return jsonResponse({ code: "command_not_found", message: "Pending command not found." }, 404);
    }
    return jsonResponse({ ok: true, commandId });
  });
}