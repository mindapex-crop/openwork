/**
 * Auth session hook entrypoint.
 *
 * This is the L1 Adapter B — den-api/src/auth.ts imports exactly two symbols:
 * `ensurePersonalTeamForUser` (throws on internal errors, returns status
 * discriminated union on validation failures) and
 * `ensurePersonalTeamForUserSafe` (NEVER throws, so a plugin bug can never
 * block user sign-in — that's the hard contract).
 *
 * Hook contract:
 *   Called once per better-auth `session.create` event. Idempotent. The
 *   activeOrganizationId MAY be null (e.g. org-less onboarding paths) — in
 *   that case we're a complete no-op because a team needs an org.
 */
import { isTeamAutonomyEnabled } from "../shared/feature-flag.js";
import type { TeamAutonomyLogger } from "../shared/types.js";

type NoThrowLogger = Pick<TeamAutonomyLogger, "warn" | "error">;

/**
 * Safe, never-throws variant. This is the one auth.ts should call. A plugin
 * failure must never turn away a legitimate sign-in. Returns true when the
 * user ended up with a personal team (or didn't need one because org was
 * null or the plugin was off), false + a reason code otherwise.
 */
export async function ensurePersonalTeamForUserSafe(
  userId: string,
  activeOrganizationId: string | null | undefined,
  deps: {
    logger: NoThrowLogger;
    /**
     * Injectable implementation — defaults to the current den-api service
     * via lazy workspace import. Swap for tests.
     */
    impl?: (userId: string, organizationId: string) => Promise<unknown>;
  },
): Promise<{ ok: boolean; skipped?: string; error?: unknown }> {
  if (!isTeamAutonomyEnabled()) {
    return { ok: true, skipped: "disabled" };
  }
  if (!activeOrganizationId) {
    return { ok: true, skipped: "no-active-organization" };
  }
  if (!userId) {
    return { ok: false, skipped: "no-user-id" };
  }
  try {
    const impl = deps.impl ?? defaultEnsureImpl;
    await impl(userId, activeOrganizationId);
    return { ok: true };
  } catch (err) {
    deps.logger?.warn?.("auth.session.create: team-autonomy ensurePersonalTeam failed (non-blocking)", {
      userId,
      activeOrganizationId,
      err,
    });
    return { ok: false, error: err };
  }
}

/**
 * Propagating variant. Exposed for direct-call services that DO want to
 * surface errors (e.g. backfills, manual onboarding triggers). auth.ts hook
 * MUST NOT use this — use the safe variant.
 */
export async function ensurePersonalTeamForUser(
  userId: string,
  activeOrganizationId: string,
  impl?: (userId: string, organizationId: string) => Promise<unknown>,
): Promise<unknown> {
  if (!isTeamAutonomyEnabled()) return undefined;
  const run = impl ?? defaultEnsureImpl;
  return run(userId, activeOrganizationId);
}

// ---- default implementation bridged from den-api during migration ----
async function defaultEnsureImpl(userId: string, organizationId: string): Promise<unknown> {
  // Lazy bridge: resolve the currently-in-den-api personal-team module via
  // its known workspace path. Post-migration this will be a local service.
  //
  // TypeScript cannot resolve cross-workspace src/ imports when the package
  // exports don't declare those paths. This is expected — the dynamic
  // import is a WORKSPACE link resolved by Node at runtime via
  // pnpm-workspace's node_modules symlink.
  //
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - workspace runtime import, types loaded via symlink
  const mod = await import("@openwork-ee/den-api/src/team-autonomy/personal-team.js");
  return mod.ensurePersonalTeamForUser(userId as never, organizationId as never);
}
