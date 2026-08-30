import { getUsageSummary, type UsageSummaryFilter } from "../usage.js";
import { ApiError } from "../errors.js";
import type { ServerConfig, WorkspaceInfo } from "../types.js";
import { addRoute, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;

interface RegisterUsageRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  resolveWorkspace: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}

function optionalIntegerParam(value: string | null, name: string): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, "invalid_query", `${name} must be a millisecond timestamp`);
  }
  return Math.trunc(parsed);
}

/**
 * BYO (bring-your-own key) usage endpoint. Aggregates session-level token
 * usage by provider/model and returns estimated USD cost alongside it.
 */
export function registerUsageRoutes(options: RegisterUsageRoutesOptions): void {
  const { routes, config, jsonResponse, resolveWorkspace } = options;

  addRoute(routes, "GET", "/api/usage/summary", "client", async (ctx) => {
    const workspaceId = ctx.url.searchParams.get("workspaceId")?.trim() || undefined;
    if (workspaceId) {
      await resolveWorkspace(config, workspaceId);
    }
    const sessionId = ctx.url.searchParams.get("sessionId")?.trim() || undefined;
    const from = optionalIntegerParam(ctx.url.searchParams.get("from"), "from");
    const to = optionalIntegerParam(ctx.url.searchParams.get("to"), "to");
    const filter: UsageSummaryFilter = {
      ...(workspaceId ? { workspaceId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
    };
    const summary = await getUsageSummary(config, filter);
    return jsonResponse(summary);
  });
}
