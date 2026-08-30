# G3: Mobile Completeness — Test Report

## Summary

De-mocked ProjectsScreen and AutomationsScreen to use real server APIs, added ModelSelectionScreen, and created server-side automations store + REST endpoints.

## Server Changes

### Automations Store (`apps/server/src/automations/automation-store.ts`)
- SQLite table `automations` (id, name, description, enabled, trigger, updated_at)
- CRUD: `all`, `get`, `create`, `toggle`, `remove`

### Automations Routes (`apps/server/src/routes/automations.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/automations` | List all automations |
| POST | `/api/automations` | Create automation |
| POST | `/api/automations/:id/toggle` | Toggle enabled |
| DELETE | `/api/automations/:id` | Delete automation |

Registered in `server.ts` alongside project routes.

## Mobile Changes

### De-mocked Screens
- **ProjectsScreen** — wired to `GET /workspaces` (workspaces = projects); pull-to-refresh + error retry
- **AutomationsScreen** — wired to `GET /api/automations` + `POST /api/automations/:id/toggle`; optimistic toggle with rollback on error; pull-to-refresh

### New Screen: ModelSelectionScreen
- Fetches available agents from `GET /agent-runtimes`
- Fetches models from `GET /agent-runtimes/:agentId/models`
- List with selected indicator, pull-to-refresh
- Navigation route `ModelSelection` added to `RootStackParamList`

### New API Clients
- `src/api/projects.ts` — `projectsApi.list()` via `/workspaces`
- `src/api/automations.ts` — `automationsApi.list/toggle/create/remove`
- `src/api/models.ts` — `modelsApi.listAgents/listModels`

### i18n
- Added keys: `projects.loadFailed`, `automations.loadFailed`, `models.title`, `models.select_title`, `models.empty`, `models.loadFailed` (zh + en)

## Test Results

### Server Automations Tests (`apps/server/src/routes/automations.test.ts`)
```
bun test src/routes/automations.test.ts
6 pass
0 fail
13 expect() calls
```

Tests cover:
- Empty list initially
- Create automation
- List after create
- Toggle enabled/disabled
- Delete automation
- Reject empty name (400)

### Mobile Tests
```
npx jest
6 suites, 42 tests, all pass
```

### Server Existing Tests (regression)
```
bun test src/routes/devices.test.ts src/routes/projects.test.ts
17 pass
0 fail
```

### Typecheck
- Server: no automations-related errors
- Mobile: no errors in new screens

## Status: PASSED