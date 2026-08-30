/**
 * Expert Routes - 专家管理 API
 *
 * 契约（前端按此对接）：
 * GET    /experts      → { experts: ExpertDefinition[] }  列出所有专家
 * POST   /experts      → 201 ExpertDefinition            创建专家
 * GET    /experts/:id  → ExpertDefinition                获取单个专家
 * PUT    /experts/:id  → ExpertDefinition                更新专家
 * DELETE /experts/:id  → { success: true }               删除专家
 */

import { addRoute, type Route } from "./registry.js";
import { ExpertStore, type ExpertCreateInput, type ExpertUpdateInput } from "../experts/index.js";

export interface RegisterExpertRoutesOptions {
  routes: Route[];
  jsonResponse: (data: unknown, status?: number) => Response;
  readJsonBody: (request: Request) => Promise<unknown>;
  /** 专家存储目录（测试可注入临时目录） */
  expertsDir?: string;
}

export function registerExpertRoutes(options: RegisterExpertRoutesOptions): void {
  const { routes, jsonResponse, readJsonBody } = options;

  // 同时注册 /experts 与 /api/experts 两套前缀，兼容桌面前端(/api/experts)与
  // 移动端/内部调用(/experts)两种接入方式
  const apiAdd = (
    method: string,
    path: string,
    auth: "none" | "client" | "host" | "host-token",
    handler: (ctx: import("./registry.js").RequestContext) => Promise<Response>,
  ): void => {
    addRoute(routes, method, path, auth, handler);
    addRoute(routes, method, `/api${path}`, auth, handler);
  };

  // Expert store singleton（惰性初始化）
  let store: ExpertStore | null = null;
  function getStore(): ExpertStore {
    if (!store) {
      const dir = options.expertsDir ?? process.env.OPENWORK_EXPERTS_DIR ?? "./experts";
      store = new ExpertStore(dir);
    }
    return store;
  }

  // GET /experts - 列出所有专家
  apiAdd("GET", "/experts", "none", async () => {
    const expertStore = getStore();
    const experts = await expertStore.list();
    return jsonResponse({ experts });
  });

  // GET /experts/:id - 获取单个专家
  apiAdd("GET", "/experts/:id", "none", async (ctx) => {
    const expertStore = getStore();
    const expert = await expertStore.get(ctx.params.id);
    if (!expert) {
      return jsonResponse({ error: "not_found", message: "Expert not found" }, 404);
    }
    return jsonResponse(expert);
  });

  // POST /experts - 创建专家
  apiAdd("POST", "/experts", "none", async (ctx) => {
    const expertStore = getStore();
    const body = (await readJsonBody(ctx.request)) as ExpertCreateInput;

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid_body", message: "invalid body" }, 400);
    }
    if (!body.name?.trim() || !body.systemPrompt?.trim()) {
      return jsonResponse(
        { error: "invalid_input", message: "name and systemPrompt are required" },
        400,
      );
    }

    const expert = await expertStore.create(body);
    return jsonResponse(expert, 201);
  });

  // PUT /experts/:id - 更新专家
  apiAdd("PUT", "/experts/:id", "none", async (ctx) => {
    const expertStore = getStore();
    const body = (await readJsonBody(ctx.request)) as ExpertUpdateInput;

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "invalid_body", message: "invalid body" }, 400);
    }

    const expert = await expertStore.update(ctx.params.id, body);
    if (!expert) {
      return jsonResponse({ error: "not_found", message: "Expert not found" }, 404);
    }
    return jsonResponse(expert);
  });

  // DELETE /experts/:id - 删除专家
  apiAdd("DELETE", "/experts/:id", "none", async (ctx) => {
    const expertStore = getStore();
    const deleted = await expertStore.delete(ctx.params.id);
    if (!deleted) {
      return jsonResponse({ error: "not_found", message: "Expert not found" }, 404);
    }
    return jsonResponse({ success: true });
  });
}
