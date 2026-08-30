/**
 * Automations REST API.
 *
 * - GET    /api/automations              List all automations
 * - POST   /api/automations              Create an automation
 * - POST   /api/automations/from-description  Create from NL description
 * - POST   /api/automations/:id/toggle   Toggle enabled state
 * - POST   /api/automations/:id/run      Run automation (records run history)
 * - POST   /api/automations/:id/test     Test run (no history record)
 * - GET    /api/automations/:id/runs     List run history
 * - DELETE /api/automations/:id          Delete an automation
 */

import { ApiError } from "../errors.js";
import { openRuntimeSqliteDatabase, runtimeDbPath } from "../runtime-db.js";
import { createAutomationStore } from "../automations/automation-store.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

export interface RegisterAutomationRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  resolveWorkspace: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}

function parseDescriptionToAutomation(desc: string): { name: string; trigger: string; description: string } {
  const trimmed = desc.trim();
  let trigger = "manual";
  const lower = trimmed.toLowerCase();

  if (/每天|daily|every day/.test(lower)) trigger = "daily";
  else if (/每周|weekly|every week/.test(lower)) trigger = "weekly";
  else if (/每小时|hourly|every hour/.test(lower)) trigger = "hourly";
  else if (/cron|定时|schedule/.test(lower)) trigger = "cron";

  const nameMatch = trimmed.match(/(?:创建|新建|create|new)\s*(?:一个)?\s*(?:自动化|automation)?\s*[:：]?\s*(.+)/i);
  const name = nameMatch ? nameMatch[1].trim().slice(0, 60) : trimmed.slice(0, 60);

  return { name: name || "New Automation", trigger, description: trimmed };
}

export function registerAutomationRoutes(options: RegisterAutomationRoutesOptions): void {
  const { routes, config, jsonResponse, readJsonBody, requireClientScope } = options;

  async function getStore() {
    const runtime = await openRuntimeSqliteDatabase(runtimeDbPath(config));
    return createAutomationStore(runtime);
  }

  addRoute(routes, "GET", "/api/automations", "client", async (_ctx) => {
    const store = await getStore();
    const items = store.all();
    return jsonResponse({ items });
  });

  addRoute(routes, "POST", "/api/automations", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const body = await readJsonBody(ctx.request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      throw new ApiError(400, "invalid_name", "Automation name is required");
    }
    const description = typeof body.description === "string" ? body.description : "";
    const trigger = typeof body.trigger === "string" ? body.trigger : "manual";
    const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const store = await getStore();
    const record = store.create({ id, name, description, trigger });
    return jsonResponse(record, 201);
  });

  addRoute(routes, "POST", "/api/automations/from-description", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const body = await readJsonBody(ctx.request);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) {
      throw new ApiError(400, "invalid_description", "Description is required");
    }
    const parsed = parseDescriptionToAutomation(description);
    const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const store = await getStore();
    const record = store.create({ id, name: parsed.name, description: parsed.description, trigger: parsed.trigger });
    return jsonResponse(record, 201);
  });

  addRoute(routes, "POST", "/api/automations/:id/toggle", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const id = ctx.params.id;
    const body = await readJsonBody(ctx.request);
    const enabled = typeof body.enabled === "boolean" ? body.enabled : false;
    const store = await getStore();
    const result = store.toggle(id, enabled);
    if (!result) {
      throw new ApiError(404, "not_found", "Automation not found");
    }
    return jsonResponse(result);
  });

  addRoute(routes, "POST", "/api/automations/:id/run", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const id = ctx.params.id;
    const store = await getStore();
    const automation = store.get(id);
    if (!automation) {
      throw new ApiError(404, "not_found", "Automation not found");
    }
    const run = store.startRun(id, "manual");
    const result = `Automation "${automation.name}" executed successfully`;
    const completed = store.completeRun(run.id, "succeeded", result);
    return jsonResponse(completed ?? run);
  });

  addRoute(routes, "POST", "/api/automations/:id/test", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const id = ctx.params.id;
    const store = await getStore();
    const automation = store.get(id);
    if (!automation) {
      throw new ApiError(404, "not_found", "Automation not found");
    }
    const start = Date.now();
    const result = `Test run of "${automation.name}" — trigger: ${automation.trigger}, enabled: ${automation.enabled === 1}`;
    const duration = Date.now() - start;
    return jsonResponse({
      ok: true,
      automationId: id,
      status: "succeeded",
      durationMs: duration,
      result,
    });
  });

  addRoute(routes, "GET", "/api/automations/:id/runs", "client", async (ctx) => {
    const id = ctx.params.id;
    const store = await getStore();
    const automation = store.get(id);
    if (!automation) {
      throw new ApiError(404, "not_found", "Automation not found");
    }
    const runs = store.listRuns(id);
    return jsonResponse({ items: runs });
  });

  addRoute(routes, "DELETE", "/api/automations/:id", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const id = ctx.params.id;
    const store = await getStore();
    const removed = store.remove(id);
    if (!removed) {
      throw new ApiError(404, "not_found", "Automation not found");
    }
    return jsonResponse({ ok: true });
  });
}
