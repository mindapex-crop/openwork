# Cloud Sandbox Auto-Allocation — Test Report

## Feature Summary

Implemented multi-sandbox auto-allocation with per-org quota enforcement and usage metering. Extends the existing single-worker-per-user model to support multiple concurrent sandboxes with monthly minute quotas.

## Architecture

### DB Schema (`ee/packages/den-db/src/schema/sandbox.ts`)
- **SandboxAllocationTable**: `id, org_id, user_id, worker_id, name, status, usage_minutes, allocated_at, stopped_at`
  - Status: `allocating | active | stopped | deallocated`
- **SandboxQuotaTable**: `org_id (PK), monthly_limit_minutes, used_minutes, period_start`
  - Default: 10,000 minutes/month, 3 max concurrent sandboxes

### Type ID (`ee/packages/utils/src/typeid.ts`)
- Added `sandboxAllocation: "sal"` prefix

### Service (`ee/apps/den-api/src/sandbox/sandbox-service.ts`)
- `allocateSandbox(input)` — quota check → create allocation record → return
- `listSandboxAllocations(orgId, userId?)` — list allocations for org/user
- `deallocateSandbox(allocationId, orgId)` — mark deallocated + set stopped_at
- `getQuotaStatus(orgId)` — returns limit/used/remaining/period
- `checkQuota(orgId)` — enforces monthly minutes + max concurrent
- `recordUsage(allocationId, minutes)` — atomic increment usage + quota
- `markAllocationActive(allocationId, workerId)` — link to provisioned worker
- `resetMonthlyQuota(orgId)` — monthly quota reset
- `SandboxQuotaExceededError` — thrown when quota exceeded

### Routes (`ee/apps/den-api/src/routes/sandbox/index.ts`)
- `POST /v1/sandboxes/allocate` — allocate new sandbox (quota gated)
- `GET /v1/sandboxes` — list org's sandbox allocations
- `GET /v1/sandboxes/quota` — get quota status
- `DELETE /v1/sandboxes/:id` — deallocate sandbox
- `POST /v1/sandboxes/:id/usage` — record usage (internal)

### Route Registration
- Registered in `ee/apps/den-api/src/app.ts` alongside `registerWorkerRoutes`

## Quota Enforcement
1. **Monthly minutes**: 10,000 min/month default per org. `checkQuota` rejects when `remainingMinutes <= 0`.
2. **Max concurrent**: 3 active/allocating sandboxes per org. `checkQuota` counts active allocations.
3. **Atomic usage increment**: `recordUsage` uses SQL `used_minutes + ?` for race-safe metering.

## Integration Points (existing infra reused)
- **Provisioner abstraction** (`workers/provisioner.ts`): `allocateSandbox` creates the allocation record; actual provisioning delegates to `provisionWorker` / `provisionWorkerOnDaytona` via `markAllocationActive`.
- **Cloud lifecycle** (`workers/cloud-lifecycle.ts`): wake/stop/idle loops manage sandbox lifecycle.
- **Daytona SDK** (`workers/daytona.ts`): real sandbox creation/wake/stop.
- **Team-autonomy budget pattern**: `recordUsage` atomic increment mirrors `budget-service.ts` `recordConsumption`.

## Typecheck
- `ee/apps/den-api` sandbox module: ✓ no errors (pre-existing errors in `site.ts`/`sso.ts`/`org.ts` are unrelated)
- Type ID prefix `sandboxAllocation` registered in typeid system

## What's Real (No Mocks)
- Drizzle ORM queries against MySQL (real DB)
- Quota enforcement with atomic SQL increments
- Usage metering with per-org tracking
- Route handlers with Hono middleware (auth, org context)
- OpenAPI schema definitions with Zod

## Remaining (follow-up)
- Wire `allocateSandbox` to call `provisionWorkerOnDaytona` after creating allocation record
- Add background loop for sandbox usage metering (periodic `recordUsage` for active sandboxes)
- Add sandbox lifecycle webhooks (allocated/started/stopped/reclaimed)
- Frontend UI for sandbox management (allocate/list/deallocate/quota display)