/**
 * 移动端运行时配置。
 *
 * 默认连接本机 openwork-server（默认端口 8787，见 apps/server/src/config.ts DEFAULT_PORT）。
 * - 真机调试时把 DEFAULT_SERVER_URL 改为电脑的局域网 IP，例如 http://192.168.1.10:8787。
 * - bearerToken 为空时不发送 Authorization 头（/experts、/chat/channels 无需鉴权）；
 *   会话/工作区接口需要 client token，可在设置页填写，或使用 server 的 OPENWORK_DEV_MODE。
 * - workspaceId 为空时，客户端会先请求 GET /workspaces 自动探测第一个工作区。
 */

export interface AppConfig {
  /** openwork-server 基础地址（无尾斜杠） */
  serverUrl: string;
  /** 目标工作区 id；为空时自动从 GET /workspaces 探测 */
  workspaceId: string;
  /** client 令牌（Bearer token），可选 */
  bearerToken: string;
  /** 单次请求超时（毫秒） */
  timeoutMs: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  serverUrl: "http://127.0.0.1:8787",
  workspaceId: "",
  bearerToken: "",
  timeoutMs: 15_000,
};

/** 设置页可编辑的配置（serverUrl / bearerToken / workspaceId） */
export type EditableConfig = Pick<AppConfig, "serverUrl" | "workspaceId" | "bearerToken">;
