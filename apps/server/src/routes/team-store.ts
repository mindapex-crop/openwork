/**
 * Team Store - 团队持久化（sqlite）
 *
 * 用 better-sqlite3/drizzle 所在运行时（bun:sqlite / node:sqlite）持久化团队定义，
 * 服务重启后团队不丢失。JSON 序列化整条记录到 value_json 列。
 *
 * 参考 runtime-db.ts 的连接模式：按路径缓存连接，同路径复用。
 */

import { join } from "node:path";
import { openworkConfigDir } from "@openwork/paths";
import { openRuntimeSqliteDatabase, type RuntimeSqliteDatabase } from "../runtime-db.js";
import type { TeamStrategyId } from "../agent-team/team-strategies.js";

/** 团队持久化模型（与原有内存 Map 形状一致，保证 API 契约不变） */
export interface StoredTeam {
  id: string;
  name: string;
  strategy: TeamStrategyId;
  memberSpecs: Array<{ agentId: string; role?: string }>;
  harnessId: string;
  createdAt: number;
  updatedAt: number;
  status: "idle" | "running" | "completed" | "failed";
  lastTaskResult?: {
    taskId: string;
    subtasks: Array<{
      subtaskId: string;
      agentId: string;
      prompt: string;
      status: string;
      outputTail?: string;
    }>;
    completedAt: number;
  };
}

const CREATE_TABLE_SQL =
  `CREATE TABLE IF NOT EXISTS teams (` +
  `id TEXT PRIMARY KEY NOT NULL, ` +
  `value_json TEXT NOT NULL, ` +
  `updated_at INTEGER NOT NULL)`;

const UPSERT_SQL =
  `INSERT INTO teams (id, value_json, updated_at) VALUES (?, ?, ?) ` +
  `ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`;

const teamDbByPath = new Map<string, Promise<TeamStore>>();

/** 默认团队库路径（可用 OPENWORK_TEAMS_DB 覆盖） */
export function defaultTeamStorePath(): string {
  const override = process.env.OPENWORK_TEAMS_DB?.trim();
  if (override) return override;
  return join(openworkConfigDir(), "teams.sqlite");
}

export class TeamStore {
  private readonly runtime: RuntimeSqliteDatabase;

  private constructor(runtime: RuntimeSqliteDatabase) {
    this.runtime = runtime;
    if (runtime.kind === "bun") {
      runtime.sqlite.run(CREATE_TABLE_SQL);
    } else {
      runtime.sqlite.exec(CREATE_TABLE_SQL);
    }
  }

  /** 打开（或新建）团队库连接（不缓存） */
  static async open(path: string): Promise<TeamStore> {
    const runtime = await openRuntimeSqliteDatabase(path);
    return new TeamStore(runtime);
  }

  /** 按路径获取团队库（连接缓存，同路径复用） */
  static async getOrOpen(path: string): Promise<TeamStore> {
    const existing = teamDbByPath.get(path);
    if (existing) return existing;
    const store = TeamStore.open(path);
    teamDbByPath.set(path, store);
    return store;
  }

  /** 测试用：清空连接缓存 */
  static resetCache(): void {
    teamDbByPath.clear();
  }

  list(): StoredTeam[] {
    const rows = this.runtime.sqlite.prepare(`SELECT value_json AS valueJson FROM teams`).all() as Array<{
      valueJson: string;
    }>;
    return rows
      .map((r) => JSON.parse(r.valueJson) as StoredTeam)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  get(id: string): StoredTeam | undefined {
    const row = this.runtime.sqlite.prepare(
      `SELECT value_json AS valueJson FROM teams WHERE id = ?`,
    ).get(id) as { valueJson: string } | undefined;
    return row ? (JSON.parse(row.valueJson) as StoredTeam) : undefined;
  }

  set(team: StoredTeam): void {
    this.runtime.sqlite
      .prepare(UPSERT_SQL)
      .run(team.id, JSON.stringify(team), team.updatedAt);
  }

  delete(id: string): boolean {
    const result = this.runtime.sqlite.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
    return (result as { changes?: number }).changes ? true : false;
  }

  close(): void {
    this.runtime.close();
  }
}
