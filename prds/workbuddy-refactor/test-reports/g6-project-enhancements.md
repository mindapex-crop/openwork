# G6: Project Enhancements — Test Report

## Feature Summary

Implemented four project enhancements: template CRUD, 5GB capacity display, invite approval flow, and task transfer packaging.

## Architecture

### Server (`apps/server/src/projects/` + `apps/server/src/routes/projects.ts`)
- **Project Store** (`project-store.ts`): SQLite tables `project_templates` + `project_invites` + `project_members`
- **Project Service** (`project-service.ts`): Template CRUD, invite lifecycle, member management, capacity computation (5GB default)
- **REST Routes** (`routes/projects.ts`): 13 endpoints
  - `GET/POST /api/projects/templates` — list/create templates
  - `GET/PUT/DELETE /api/projects/templates/:templateId` — template CRUD
  - `POST /api/projects/invites` — create invite
  - `GET /api/projects/:projectId/invites` — list invites
  - `POST /api/projects/invites/:inviteId/approve` — approve invite
  - `POST /api/projects/invites/:inviteId/reject` — reject invite
  - `POST /api/projects/join` — join project with invite code
  - `GET /api/projects/:projectId/members` — list members
  - `DELETE /api/projects/:projectId/members/:userId` — remove member
  - `GET /api/projects/:projectId/capacity` — capacity usage (walks workspace, sums file sizes, compares to 5GB)

### Frontend (`apps/app/src/react-app/domains/projects/`)
- **Task type extended**: `deliverables?`, `progressSummary?`, `customFields?`
- **TaskDeliverable type**: `{ name, path, type: "file"|"artifact"|"link", createdAt }`
- **TaskTransferPackage type**: packaged task for cross-project transfer
- **New store actions**: `setTaskDeliverables`, `setTaskProgressSummary`, `setTaskCustomFields`, `packageTaskForTransfer`, `transferTask`

### i18n
- 27 new keys added to `en.ts` and `zh.ts` (`projects.*` namespace: templates, capacity, invites, task transfer)

## Test Results

### Server Route Tests (`apps/server/src/routes/projects.test.ts`)
```
8 pass, 0 fail, 39 expect() calls
```
Tests:
1. Template CRUD full flow (create → list → get → update → delete)
2. Invite approval full flow (create → approve → join → list members → remove)
3. Unapproved invite cannot join → 400 invite_not_approved
4. Reject invite → status rejected
5. Capacity calculation returns 5GB limit and used space
6. Create template missing name → 400 invalid_name
7. Delete non-existent template → 404
8. Remove non-existent member → 404

### Frontend Store Tests (`apps/app/tests/project-task-transfer.test.ts`)
```
4 pass, 0 fail
```
Tests:
1. packageTaskForTransfer packages deliverables + progress summary + custom fields + subtask summary
2. transferTask transfers task across projects (source loses task, target gains task with status reset to todo)
3. transferTask with non-existent source → false
4. setTaskDeliverables / setTaskProgressSummary / setTaskCustomFields persist to task

### Typecheck
- `apps/server`: ✓ pass
- `apps/app`: ✓ pass
- `apps/mobile`: ✓ pass

### i18n Audit
- Placeholder integrity: ✓
- Plural completeness: ✓ (all 10 locales)
- zh parity: ✓ (100%)

## Bug Fixed During Development
- `SqliteProjectStore.isMember()`: Bun SQLite `.get()` returns `null` (not `undefined`) for no rows — changed `!== undefined` to `!= null` to correctly detect non-membership.