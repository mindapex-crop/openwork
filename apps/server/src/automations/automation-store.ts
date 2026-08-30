import type { RuntimeSqliteDatabase } from "../runtime-db.js";

export interface AutomationRecord {
  id: string;
  name: string;
  description: string;
  enabled: number;
  trigger: string;
  updated_at: number;
}

export interface AutomationRunRecord {
  id: string;
  automation_id: string;
  status: string;
  trigger: string;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  result: string | null;
}

const CREATE_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS automations (" +
  "id TEXT PRIMARY KEY NOT NULL, " +
  "name TEXT NOT NULL, " +
  "description TEXT NOT NULL DEFAULT '', " +
  "enabled INTEGER NOT NULL DEFAULT 1, " +
  "trigger TEXT NOT NULL DEFAULT 'manual', " +
  "updated_at INTEGER NOT NULL)";

const CREATE_RUNS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS automation_runs (" +
  "id TEXT PRIMARY KEY NOT NULL, " +
  "automation_id TEXT NOT NULL, " +
  "status TEXT NOT NULL DEFAULT 'running', " +
  "trigger TEXT NOT NULL DEFAULT 'manual', " +
  "started_at INTEGER NOT NULL, " +
  "completed_at INTEGER, " +
  "duration_ms INTEGER, " +
  "result TEXT)";

const CREATE_RUNS_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_automation_runs_aid " +
  "ON automation_runs(automation_id, started_at DESC)";

interface AutomationRow {
  id: string;
  name: string;
  description: string;
  enabled: number;
  trigger: string;
  updated_at: number;
}

interface AutomationRunRow {
  id: string;
  automation_id: string;
  status: string;
  trigger: string;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  result: string | null;
}

function toRecord(row: AutomationRow): AutomationRecord {
  return { ...row };
}

function toRunRecord(row: AutomationRunRow): AutomationRunRecord {
  return { ...row };
}

function exec(runtime: RuntimeSqliteDatabase, sql: string) {
  if (runtime.kind === "bun") runtime.sqlite.exec(sql);
  else runtime.sqlite.exec(sql);
}

function prepare(runtime: RuntimeSqliteDatabase, sql: string) {
  return runtime.kind === "bun" ? runtime.sqlite.prepare(sql) : runtime.sqlite.prepare(sql);
}

export function createAutomationStore(runtime: RuntimeSqliteDatabase) {
  exec(runtime, CREATE_TABLE_SQL);
  exec(runtime, CREATE_RUNS_TABLE_SQL);
  exec(runtime, CREATE_RUNS_INDEX_SQL);

  function all(): AutomationRecord[] {
    const rows = prepare(runtime, "SELECT * FROM automations ORDER BY updated_at DESC").all() as unknown as AutomationRow[];
    return rows.map(toRecord);
  }

  function get(id: string): AutomationRecord | null {
    const row = prepare(runtime, "SELECT * FROM automations WHERE id = ?").get(id) as unknown as AutomationRow | null;
    return row ? toRecord(row) : null;
  }

  function create(input: { id: string; name: string; description?: string; trigger?: string }): AutomationRecord {
    const now = Date.now();
    const record: AutomationRecord = {
      id: input.id,
      name: input.name,
      description: input.description ?? "",
      enabled: 1,
      trigger: input.trigger ?? "manual",
      updated_at: now,
    };
    prepare(runtime, "INSERT INTO automations (id, name, description, enabled, trigger, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(record.id, record.name, record.description, record.enabled, record.trigger, record.updated_at);
    return record;
  }

  function toggle(id: string, enabled: boolean): AutomationRecord | null {
    const existing = get(id);
    if (!existing) return null;
    const now = Date.now();
    prepare(runtime, "UPDATE automations SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, now, id);
    return get(id);
  }

  function remove(id: string): boolean {
    const result = prepare(runtime, "DELETE FROM automations WHERE id = ?").run(id);
    return result.changes > 0;
  }

  function startRun(automationId: string, trigger: string): AutomationRunRecord {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    prepare(runtime, "INSERT INTO automation_runs (id, automation_id, status, trigger, started_at) VALUES (?, ?, 'running', ?, ?)")
      .run(runId, automationId, trigger, now);
    return toRunRecord(prepare(runtime, "SELECT * FROM automation_runs WHERE id = ?").get(runId) as unknown as AutomationRunRow);
  }

  function completeRun(runId: string, status: string, result: string | null): AutomationRunRecord | null {
    const row = prepare(runtime, "SELECT * FROM automation_runs WHERE id = ?").get(runId) as unknown as AutomationRunRow | null;
    if (!row) return null;
    const now = Date.now();
    const duration = now - row.started_at;
    prepare(runtime, "UPDATE automation_runs SET status = ?, completed_at = ?, duration_ms = ?, result = ? WHERE id = ?")
      .run(status, now, duration, result, runId);
    return toRunRecord(prepare(runtime, "SELECT * FROM automation_runs WHERE id = ?").get(runId) as unknown as AutomationRunRow);
  }

  function listRuns(automationId: string, limit = 20): AutomationRunRecord[] {
    const rows = prepare(runtime, "SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?")
      .all(automationId, limit) as unknown as AutomationRunRow[];
    return rows.map(toRunRecord);
  }

  return { all, get, create, toggle, remove, startRun, completeRun, listRuns };
}

export type AutomationStore = ReturnType<typeof createAutomationStore>;
