/**
 * @openwork-ee/team-autonomy — public barrel export.
 *
 * L3 plugin package. All team-autonomy business logic (services, routes,
 * auth session hook, UI extension manifest) lives here, decoupled from
 * OpenWork core. Only 3 tiny adapter seams inside den-api/app + den-api/auth
 * + den-db/schema re-export wire this package in. The adapters short-circuit
 * when TEAM_AUTONOMY_ENABLED is not truthy, so pristine upstream/dev works
 * without this package being touched.
 */

export * from "./auth/hook.js";
export * from "./http/routes.js";
export { registerTeamAutonomyRoutes } from "./http/routes.js";
export { teamAutonomyExtensionManifest } from "./ui/manifest.js";
export type {
  TeamAutonomyEnv,
  TeamAutonomyRouteVariables,
} from "./shared/types.js";
export {
  isTeamAutonomyEnabled,
  requireTeamAutonomyEnabled,
} from "./shared/feature-flag.js";
