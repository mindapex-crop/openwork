/**
 * ChatChannelStore — IM 通道配置的 sqlite 持久化（openspec-chat-bridge.md 阶段四）
 *
 * 各 IM 平台（企微/飞书/钉钉/Slack/Discord）的 webhookUrl / token / enabled
 * 配置以 channelId 为键存储在 runtime DB 中（复用 runtime-db.ts 的驱动选择，
 * 与 workspace-kv-store 同构但按通道而非 workspace 分桶）。
 *
 * 不变量：
 * I1: channelId 唯一（PRIMARY KEY），save 为 upsert
 * I2: 读取永不物化 runtime DB（空文件读作空列表，避免启动时创建空 sqlite）
 * I3: 所有写入返回的 updatedAt 为 number（由调用方或存储生成）
 */

import { existsSync } from "node:fs";
import { openRuntimeSqliteDatabase, runtimeDbPath, type RuntimeSqliteDatabase } from "../runtime-db.js";
import type { ServerConfig } from "../types.js";

/** 内置 IM 通道 id（store 本身不做白名单，未来可扩展自定义 webhook） */
export type ImChannelId = "wecom" | "feishu" | "dingtalk" | "slack" | "discord";

export const IM_CHANNEL_IDS: readonly ImChannelId[] = ["wecom", "feishu", "dingtalk", "slack", "discord"];

export interface ChatChannelConfig {
  /** 通道 id（wecom / feishu / dingtalk / slack / discord） */
  channelId: string;
  /** 出站 webhook URL（平台机器人回调地址） */
  webhookUrl: string;
  /** 入站校验 token / secret（可选） */
  token?: string;
  /** 是否启用（连接状态） */
  enabled: boolean;
  /** 最近保存时间戳 */
  updatedAt: number;
}

export interface ChatChannelStore {
  list(): Promise<ChatChannelConfig[]>;
  get(channelId: string): Promise<ChatChannelConfig | undefined>;
  save(config: ChatChannelConfig): Promise<ChatChannelConfig>;
  delete(channelId: string): Promise<boolean>;
}

type ChannelRow = {
  channelId: string;
  webhookUrl: string;
  token: string;
  enabled: number;
  updatedAt: number;
};

type ChannelDb = {
  list: () => ChannelRow[];
  get: (channelId: string) => ChannelRow | undefined;
  upsert: (row: ChannelRow) => void;
  delete: (channelId: string) => boolean;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS chat_channel_configs (
  channel_id TEXT PRIMARY KEY NOT NULL,
  webhook_url TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
)
`;

const dbByPath = new Map<string, Promise<RuntimeSqliteDatabase>>();
const channelDbByPath = new Map<string, Promise<ChannelDb>>();

async function runtimeDb(path: string): Promise<RuntimeSqliteDatabase> {
  const existing = dbByPath.get(path);
  if (existing) return existing;
  const db = openRuntimeSqliteDatabase(path);
  dbByPath.set(path, db);
  return db;
}

function rowFromUnknown(row: unknown): ChannelRow | undefined {
  if (typeof row !== "object" || row === null) return undefined;
  const record = row as Record<string, unknown>;
  if (typeof record.channelId !== "string") return undefined;
  return {
    channelId: record.channelId,
    webhookUrl: typeof record.webhookUrl === "string" ? record.webhookUrl : "",
    token: typeof record.token === "string" ? record.token : "",
    enabled: record.enabled === 1 || record.enabled === true ? 1 : 0,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
  };
}

async function openChannelDb(path: string): Promise<ChannelDb> {
  const runtime = await runtimeDb(path);
  if (runtime.kind === "bun") {
    const sqlite = runtime.sqlite;
    sqlite.run(CREATE_TABLE_SQL);
    const selectAll = sqlite.query(
      "SELECT channel_id AS channelId, webhook_url AS webhookUrl, token, enabled, updated_at AS updatedAt FROM chat_channel_configs ORDER BY channel_id",
    );
    const selectOne = sqlite.query(
      "SELECT channel_id AS channelId, webhook_url AS webhookUrl, token, enabled, updated_at AS updatedAt FROM chat_channel_configs WHERE channel_id = ?",
    );
    const upsert = sqlite.query(
      `INSERT INTO chat_channel_configs (channel_id, webhook_url, token, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET webhook_url = excluded.webhook_url, token = excluded.token, enabled = excluded.enabled, updated_at = excluded.updated_at`,
    );
    const remove = sqlite.query("DELETE FROM chat_channel_configs WHERE channel_id = ?");
    return {
      list: () => (selectAll.all() as unknown[]).flatMap((row) => (rowFromUnknown(row) ? [rowFromUnknown(row)!] : [])),
      get: (channelId) => rowFromUnknown(selectOne.get(channelId)),
      upsert: (row) => {
        upsert.run(row.channelId, row.webhookUrl, row.token, row.enabled, row.updatedAt);
      },
      delete: (channelId) => {
        const result = remove.run(channelId);
        return result.changes > 0;
      },
    };
  }

  const sqlite = runtime.sqlite;
  sqlite.exec(CREATE_TABLE_SQL);
  const selectAll = sqlite.prepare(
    "SELECT channel_id AS channelId, webhook_url AS webhookUrl, token, enabled, updated_at AS updatedAt FROM chat_channel_configs ORDER BY channel_id",
  );
  const selectOne = sqlite.prepare(
    "SELECT channel_id AS channelId, webhook_url AS webhookUrl, token, enabled, updated_at AS updatedAt FROM chat_channel_configs WHERE channel_id = ?",
  );
  const upsert = sqlite.prepare(
    `INSERT INTO chat_channel_configs (channel_id, webhook_url, token, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET webhook_url = excluded.webhook_url, token = excluded.token, enabled = excluded.enabled, updated_at = excluded.updated_at`,
  );
  const remove = sqlite.prepare("DELETE FROM chat_channel_configs WHERE channel_id = ?");
  return {
    list: () => (selectAll.all() as unknown[]).flatMap((row) => (rowFromUnknown(row) ? [rowFromUnknown(row)!] : [])),
    get: (channelId) => rowFromUnknown(selectOne.get(channelId)),
    upsert: (row) => {
      upsert.run(row.channelId, row.webhookUrl, row.token, row.enabled, row.updatedAt);
    },
    delete: (channelId) => {
      const result = remove.run(channelId);
      return result.changes > 0;
    },
  };
}

async function channelDb(path: string): Promise<ChannelDb | undefined> {
  const existing = channelDbByPath.get(path);
  if (existing) return existing;
  // I2: 文件不存在且未打开过 → 视为空，不创建 sqlite 文件
  if (!dbByPath.has(path) && !existsSync(path)) return undefined;
  return writableChannelDb(path);
}

async function writableChannelDb(path: string): Promise<ChannelDb> {
  const existing = channelDbByPath.get(path);
  if (existing) return existing;
  const db = openChannelDb(path);
  channelDbByPath.set(path, db);
  return db;
}

export function createChatChannelStore(config: ServerConfig): ChatChannelStore {
  const path = runtimeDbPath(config);

  return {
    async list() {
      const db = await channelDb(path);
      if (!db) return [];
      return db.list().map(rowToConfig);
    },

    async get(channelId) {
      const db = await channelDb(path);
      if (!db) return undefined;
      const row = db.get(channelId);
      return row ? rowToConfig(row) : undefined;
    },

    async save(input) {
      const db = await writableChannelDb(path);
      const row: ChannelRow = {
        channelId: input.channelId.trim(),
        webhookUrl: input.webhookUrl.trim(),
        token: (input.token ?? "").trim(),
        enabled: input.enabled ? 1 : 0,
        updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
      };
      db.upsert(row);
      return rowToConfig(row);
    },

    async delete(channelId) {
      const db = await channelDb(path);
      if (!db) return false;
      return db.delete(channelId);
    },
  };
}

function rowToConfig(row: ChannelRow): ChatChannelConfig {
  return {
    channelId: row.channelId,
    webhookUrl: row.webhookUrl,
    ...(row.token ? { token: row.token } : {}),
    enabled: row.enabled === 1,
    updatedAt: row.updatedAt,
  };
}
