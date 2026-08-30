/**
 * 项目增强 REST API：模板 CRUD + 邀请审批 + 成员管理 + 容量计算。
 *
 * - GET    /api/projects/templates                列出所有模板
 * - POST   /api/projects/templates                创建模板
 * - GET    /api/projects/templates/:templateId     获取模板
 * - PUT    /api/projects/templates/:templateId     更新模板
 * - DELETE /api/projects/templates/:templateId     删除模板
 * - POST   /api/projects/invites                  创建邀请
 * - GET    /api/projects/:projectId/invites        列出项目邀请
 * - POST   /api/projects/invites/:inviteId/approve  审批通过
 * - POST   /api/projects/invites/:inviteId/reject   审批拒绝
 * - POST   /api/projects/join                      加入项目（凭邀请码）
 * - GET    /api/projects/:projectId/members        列出成员
 * - DELETE /api/projects/:projectId/members/:userId 移除成员
 * - GET    /api/projects/:projectId/capacity       容量使用情况
 */

import { ApiError } from "../errors.js";
import { openRuntimeSqliteDatabase, runtimeDbPath } from "../runtime-db.js";
import { createProjectService, ProjectServiceError, DEFAULT_CAPACITY } from "../projects/project-service.js";
import { SqliteProjectStore } from "../projects/project-store.js";
import type { ProjectService } from "../projects/project-service.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

export interface RegisterProjectRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  resolveWorkspace: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function computeWorkspaceUsage(workspacePath: string): Promise<number> {
  let total = 0;
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const s = await stat(fullPath);
            total += s.size;
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }
  await walk(workspacePath, 0);
  return total;
}

export function registerProjectRoutes(options: RegisterProjectRoutesOptions): void {
  const { routes, config, jsonResponse, readJsonBody, ensureWritable, requireClientScope, resolveWorkspace } = options;

  let servicePromise: Promise<ProjectService> | null = null;
  async function getService(): Promise<ProjectService> {
    if (servicePromise) return servicePromise;
    servicePromise = (async () => {
      const runtime = await openRuntimeSqliteDatabase(runtimeDbPath(config));
      const store = new SqliteProjectStore(runtime);
      return createProjectService(store);
    })();
    return servicePromise;
  }

  function wrapError(error: unknown): Response {
    if (error instanceof ProjectServiceError) {
      return jsonResponse({ code: error.code, message: error.message }, 400);
    }
    if (error instanceof ApiError) {
      return jsonResponse({ code: error.code, message: error.message }, error.status);
    }
    throw error;
  }

  function parsePlans(value: unknown): CreateTemplateInput["plans"] {
    if (!Array.isArray(value)) return [];
    return value.map((plan) => {
      if (!isRecord(plan)) return { title: "", description: "", tasks: [] };
      const tasks = Array.isArray(plan.tasks) ? plan.tasks.map((task) => {
        if (!isRecord(task)) return { title: "", status: "todo" as const, priority: "medium" as const };
        return {
          title: readString(task.title),
          status: (readString(task.status) || "todo") as "todo" | "in_progress" | "review" | "done",
          priority: (readString(task.priority) || "medium") as "low" | "medium" | "high",
        };
      }) : [];
      return {
        title: readString(plan.title),
        description: readString(plan.description),
        tasks,
      };
    });
  }

  type CreateTemplateInput = {
    name: string;
    description: string;
    category: string;
    icon: string;
    plans: { title: string; description: string; tasks: { title: string; status: "todo" | "in_progress" | "review" | "done"; priority: "low" | "medium" | "high" }[] }[];
  };

  addRoute(routes, "GET", "/api/projects/templates", "client", async (ctx) => {
    const service = await getService();
    return jsonResponse({ templates: service.listTemplates() });
  });

  addRoute(routes, "POST", "/api/projects/templates", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const template = service.createTemplate(
        {
          name: readString(body.name),
          description: readString(body.description),
          category: readString(body.category),
          icon: readString(body.icon),
          plans: parsePlans(body.plans),
        },
        Date.now(),
      );
      return jsonResponse(template);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "GET", "/api/projects/templates/:templateId", "client", async (ctx) => {
    const templateId = ctx.params.templateId ?? "";
    const service = await getService();
    const template = service.getTemplate(templateId);
    if (!template) {
      return jsonResponse({ code: "template_not_found", message: "Template not found." }, 404);
    }
    return jsonResponse(template);
  });

  addRoute(routes, "PUT", "/api/projects/templates/:templateId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const templateId = ctx.params.templateId ?? "";
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const template = service.updateTemplate(
        templateId,
        {
          name: readString(body.name),
          description: readString(body.description),
          category: readString(body.category),
          icon: readString(body.icon),
          plans: parsePlans(body.plans),
        },
        Date.now(),
      );
      return jsonResponse(template);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "DELETE", "/api/projects/templates/:templateId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const templateId = ctx.params.templateId ?? "";
    const service = await getService();
    const deleted = service.deleteTemplate(templateId);
    if (!deleted) {
      return jsonResponse({ code: "template_not_found", message: "Template not found." }, 404);
    }
    return jsonResponse({ deleted: true, templateId });
  });

  addRoute(routes, "POST", "/api/projects/invites", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const invite = service.createInvite(
        {
          projectId: readString(body.projectId),
          email: typeof body.email === "string" ? body.email : undefined,
          invitedBy: readString(body.invitedBy),
        },
        Date.now(),
      );
      return jsonResponse(invite);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "GET", "/api/projects/:projectId/invites", "client", async (ctx) => {
    requireClientScope(ctx, "owner");
    const projectId = ctx.params.projectId ?? "";
    const service = await getService();
    return jsonResponse({ invites: service.listInvites(projectId) });
  });

  addRoute(routes, "POST", "/api/projects/invites/:inviteId/approve", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const inviteId = ctx.params.inviteId ?? "";
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const invite = service.approveInvite(inviteId, readString(body.resolvedBy), Date.now());
      return jsonResponse(invite);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "POST", "/api/projects/invites/:inviteId/reject", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const inviteId = ctx.params.inviteId ?? "";
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const invite = service.rejectInvite(inviteId, readString(body.resolvedBy), Date.now());
      return jsonResponse(invite);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "POST", "/api/projects/join", "client", async (ctx) => {
    ensureWritable(config);
    const body = await readJsonBody(ctx.request);
    const service = await getService();
    try {
      const member = service.joinProject(
        {
          inviteCode: readString(body.inviteCode),
          userId: readString(body.userId),
          name: readString(body.name),
        },
        Date.now(),
      );
      return jsonResponse(member);
    } catch (error) {
      return wrapError(error);
    }
  });

  addRoute(routes, "GET", "/api/projects/:projectId/members", "client", async (ctx) => {
    requireClientScope(ctx, "owner");
    const projectId = ctx.params.projectId ?? "";
    const service = await getService();
    return jsonResponse({ members: service.listMembers(projectId) });
  });

  addRoute(routes, "DELETE", "/api/projects/:projectId/members/:userId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "owner");
    const projectId = ctx.params.projectId ?? "";
    const userId = ctx.params.userId ?? "";
    const service = await getService();
    const removed = service.removeMember(projectId, userId);
    if (!removed) {
      return jsonResponse({ code: "member_not_found", message: "Member not found." }, 404);
    }
    return jsonResponse({ removed: true, userId });
  });

  addRoute(routes, "GET", "/api/projects/:projectId/capacity", "client", async (ctx) => {
    const projectId = ctx.params.projectId ?? "";
    const service = await getService();
    let usedBytes = 0;
    try {
      const workspace = await resolveWorkspace(config, projectId);
      usedBytes = await computeWorkspaceUsage(workspace.path);
    } catch {
      // workspace not found → report 0 usage
    }
    const capacity = service.computeCapacity(usedBytes);
    return jsonResponse({
      ...capacity,
      totalLabel: formatBytes(capacity.total),
      usedLabel: formatBytes(capacity.used),
    });
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[i]}`;
}

export { DEFAULT_CAPACITY };