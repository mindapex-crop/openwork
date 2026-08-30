import { create } from "zustand";

import { t } from "@/i18n";
import {
  Cloud,
  MessageSquare,
  MessagesSquare,
  Send,
} from "lucide-react";

import type { ImConnectorPlatform, ImConnectorState, ServerChatChannelConfig } from "./im-connector-state";
import {
  completeConnectFromConfig,
  INITIAL_STATES,
  requestConnect,
  statesFromServerConfigs,
} from "./im-connector-state";
import { resolveOpenworkConnection } from "../../shell/openwork-connection";

export interface ImConnectorDefinition {
  id: ImConnectorPlatform;
  /** 展示文案按当前 locale 解析：目录里只存 id 与图标，不存硬编码中文。 */
  readonly name: string;
  readonly description: string;
  icon: React.ComponentType<{ className?: string }>;
  documentationUrl?: string;
  accent: string;
}

const IM_CONNECTOR_PLATFORMS = [
  {
    id: "feishu",
    icon: MessagesSquare,
    documentationUrl: "https://open.feishu.cn/",
    accent: "bg-indigo-500",
  },
  {
    id: "wecom",
    icon: MessageSquare,
    documentationUrl: "https://developer.work.weixin.qq.com/",
    accent: "bg-sky-500",
  },
  {
    id: "dingtalk",
    icon: Send,
    documentationUrl: "https://open.dingtalk.com/",
    accent: "bg-violet-500",
  },
  {
    id: "slack",
    icon: Cloud,
    documentationUrl: "https://api.slack.com/",
    accent: "bg-rose-500",
  },
  {
    id: "discord",
    icon: MessageSquare,
    documentationUrl: "https://discord.com/developers",
    accent: "bg-indigo-600",
  },
] as const satisfies ReadonlyArray<Omit<ImConnectorDefinition, "name" | "description">>;

export const IM_CONNECTOR_DEFINITIONS: ImConnectorDefinition[] = IM_CONNECTOR_PLATFORMS.map((platform) => ({
  ...platform,
  get name() {
    return t(`im_connectors.platform_${platform.id}`);
  },
  get description() {
    return t(`im_connectors.platform_${platform.id}_desc`);
  },
}));

async function apiRequest(baseUrl: string, token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function loadChatChannels(baseUrl: string, token: string): Promise<ServerChatChannelConfig[]> {
  const body = (await apiRequest(baseUrl, token, "/api/chat-channels")) as { channels?: ServerChatChannelConfig[] } | null;
  return body?.channels ?? [];
}

export async function saveChatChannel(
  baseUrl: string,
  token: string,
  config: { channelId: ImConnectorPlatform; webhookUrl: string; token?: string },
): Promise<ServerChatChannelConfig> {
  const body = (await apiRequest(baseUrl, token, "/api/chat-channels", {
    method: "POST",
    body: JSON.stringify(config),
  })) as { channel?: ServerChatChannelConfig };
  return body.channel!;
}

export async function deleteChatChannel(baseUrl: string, token: string, channelId: ImConnectorPlatform): Promise<void> {
  await apiRequest(baseUrl, token, `/api/chat-channels/${encodeURIComponent(channelId)}`, { method: "DELETE" });
}

type ImConnectorPhase = "idle" | "loading" | "ready" | "error";

export interface ImConnectorStoreState {
  states: ImConnectorState[];
  phase: ImConnectorPhase;
  error: string | null;
  connection: { baseUrl: string; token: string } | null;
  refresh: () => Promise<void>;
  connect: (id: ImConnectorPlatform, webhookUrl: string, token?: string) => Promise<void>;
  disconnect: (id: ImConnectorPlatform) => Promise<void>;
}

export const useImConnectorStore = create<ImConnectorStoreState>((set, get) => ({
  states: INITIAL_STATES,
  phase: "idle",
  error: null,
  connection: null,

  refresh: async () => {
    set({ phase: "loading", error: null });
    try {
      const conn = await resolveOpenworkConnection();
      if (!conn.normalizedBaseUrl || !conn.resolvedToken) {
        set({ phase: "ready" });
        return;
      }
      set({ connection: { baseUrl: conn.normalizedBaseUrl, token: conn.resolvedToken } });
      const configs = await loadChatChannels(conn.normalizedBaseUrl, conn.resolvedToken);
      set({ states: statesFromServerConfigs(configs), phase: "ready" });
    } catch {
      set({ phase: "error", error: "Failed to load connectors" });
    }
  },

  connect: async (id, webhookUrl, token) => {
    const { connection } = get();
    if (!connection) return;
    set((state) => ({
      states: state.states.map((s) => requestConnect(s, id)),
    }));
    try {
      const config = await saveChatChannel(connection.baseUrl, connection.token, {
        channelId: id,
        webhookUrl,
        token,
      });
      set((state) => ({
        states: completeConnectFromConfig(state.states, id, config),
      }));
    } catch {
      set((state) => ({
        states: state.states.map((s) => (s.id === id ? { ...s, status: "disconnected" as const } : s)),
        error: "Connection failed",
      }));
    }
  },

  disconnect: async (id) => {
    const { connection } = get();
    set((state) => ({
      states: state.states.map((s) => (s.id === id ? { id, status: "disconnected" as const } : s)),
    }));
    if (!connection) return;
    try {
      await deleteChatChannel(connection.baseUrl, connection.token, id);
    } catch {
      // optimistic: already disconnected in UI
    }
  },
}));
