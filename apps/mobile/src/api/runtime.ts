import { ApiClient } from "./client";
import { DEFAULT_CONFIG } from "../config";

/**
 * 全局共享的 API 客户端实例。
 * 设置页修改 serverUrl / token / workspaceId 后调用 updateApiConfig 即时生效。
 */
export const apiClient = new ApiClient({ ...DEFAULT_CONFIG });

export function updateApiConfig(patch: Partial<typeof DEFAULT_CONFIG>): void {
  apiClient.updateConfig(patch);
}
