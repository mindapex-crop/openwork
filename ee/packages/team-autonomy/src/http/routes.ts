/**
 * HTTP route registration entrypoint.
 *
 * This is the L1 Adapter A — den-api/src/app.ts imports exactly one symbol
 * from here: `registerTeamAutonomyRoutes`. When the flag is off, this call is
 * a no-op (no routes, no startup cost). When on, it delegates to the actual
 * route modules.
 *
 * Routing contract:
 *   All routes hang off /api/teams/:teamId/. The host app is responsible for
 *   prefix normalization and middleware ordering; we mount straight into the
 *   Hono app exactly like the other den-api route modules do.
 */
import type { Hono } from "hono";
import { isTeamAutonomyEnabled } from "../shared/feature-flag.js";
import type { TeamAutonomyRouteVariables } from "../shared/types.js";

export type { TeamAutonomyRouteVariables };

type AnyHono = Hono;
type AnyRouteRegistrar = (app: Hono) => void;

export function registerTeamAutonomyRoutes<T extends { Variables: TeamAutonomyRouteVariables["Variables"] }>(
  app: Hono<T>,
): boolean {
  if (!isTeamAutonomyEnabled()) {
    return false;
  }

  // Force-cast here: the route registration functions accept any Hono app
  // since they mount routes by path (the typed Variables are used inside the
  // handlers via context, not by the registration call itself). Using
  // `as unknown as AnyHono` breaks the recursive generic loop for Hono's
  // OnHandlerInterface while preserving runtime behavior.
  const appAny = app as unknown as AnyHono;

  // Dynamic import notes (same rationale as ../auth/hook.ts):
  //   Cross-workspace src/ path dynamic imports resolve at runtime via
  //   pnpm-workspace node_modules symlinks. TypeScript can't see them
  //   because the @openwork-ee/den-api package exports don't expose
  //   internal src/ paths. Use ts-ignore + inline type assertion.
  void (async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - workspace runtime import
    const raw = await import("@openwork-ee/den-api/src/routes/team-autonomy/index.js");
    type ModShape = {
      registerTeamAgentRoutes: AnyRouteRegistrar;
      registerTeamTaskRoutes: AnyRouteRegistrar;
      registerTeamBoardRoutes: AnyRouteRegistrar;
      registerTeamArtifactRoutes: AnyRouteRegistrar;
      registerTeamAutomationRoutes: AnyRouteRegistrar;
      registerTeamInboxRoutes: AnyRouteRegistrar;
      registerTeamPermissionRoutes: AnyRouteRegistrar;
    };
    const mod = raw as ModShape;
    const registrars: AnyRouteRegistrar[] = [
      mod.registerTeamAgentRoutes,
      mod.registerTeamTaskRoutes,
      mod.registerTeamBoardRoutes,
      mod.registerTeamArtifactRoutes,
      mod.registerTeamAutomationRoutes,
      mod.registerTeamInboxRoutes,
      mod.registerTeamPermissionRoutes,
    ];
    for (const register of registrars) {
      try {
        register(appAny);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[team-autonomy] route registrar failed:", { err, registrarName: register.name });
      }
    }
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[team-autonomy] failed to load route modules:", err);
  });

  return true;
}

export function registerTeamAutonomyRoutesSync<T extends { Variables: TeamAutonomyRouteVariables["Variables"] }>(
  app: Hono<T>,
  modules: {
    registerRoutes: (app: AnyHono) => void;
  },
): boolean {
  if (!isTeamAutonomyEnabled()) return false;
  modules.registerRoutes(app as unknown as AnyHono);
  return true;
}
