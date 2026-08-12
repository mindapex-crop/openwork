// Model picker modal state: lazy option loading (with "Recently added"
// provider flagging), open-event/localStorage triggers from the new-providers
// toast, and org-restriction filtering. Extracted verbatim from
// session-route.tsx; settings-route carries a sibling copy that should adopt
// this hook next.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Client, ModelOption } from "@/app/types";
import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import { useCheckDesktopRestriction } from "@/react-app/domains/cloud/desktop-config-provider";
import { isCloudManagedProviderKey } from "@/react-app/domains/connections/provider-auth/cloud-provider-config";
import { filterEntitledModelOptions } from "@/react-app/domains/connections/provider-auth/provider-policy";
import {
  getAllProviderItems,
  useProviderListQuery,
} from "@/react-app/infra/provider-list-query";
import {
  openModelPickerEvent,
  pendingModelPickerProviderIdsKey,
} from "@/react-app/shell/new-providers-listener";

/** CLI agent 目录条目（all models 的 CLI Agents 分组数据） */
export type CliAgentItem = {
  agentId: string;
  label: string;
  vendor?: string;
  protocol: string;
  confidence?: number;
  defaultModel?: { providerID: string; modelID: string };
};

export type UseModelPickerInput = {
  client: Client | null;
  baseUrl: string;
  workspaceRoot: string;
  /** openwork server client（拉取 CLI agent runtimes，all models 展示用） */
  openworkServerClient?: OpenworkServerClient | null;
  /** Called when the picker opens so callers can reconcile remote assignments. */
  onOpen?: () => void;
  /** Optional: surface option-load failures (settings shows a toast; the session route stays silent). */
  onLoadError?: (error: unknown) => void;
};

export function useModelPicker(input: UseModelPickerInput) {
  const { client, baseUrl, workspaceRoot, openworkServerClient, onOpen, onLoadError } = input;
  const checkDesktopRestriction = useCheckDesktopRestriction();

  const [open, setOpenState] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Provider IDs that were just added — used to highlight them as
  // "Recently added" in the model picker even after they've been
  // marked as seen in localStorage.
  const [recentProviderIds, setRecentProviderIds] = useState<Set<string>>(new Set());
  const providerListQuery = useProviderListQuery({
    client,
    baseUrl,
    directory: workspaceRoot || undefined,
    enabled: open,
  });
  const setOpen = useCallback((nextOpen: boolean) => {
    setOpenState(nextOpen);
    if (nextOpen) {
      onOpen?.();
    }
  }, [onOpen]);

  // Open model picker when the global toast's "Pick a new default?" is clicked
  useEffect(() => {
    const handler = (event: Event) => {
      try {
        window.localStorage.removeItem(pendingModelPickerProviderIdsKey);
      } catch {}
      const detail = (event as CustomEvent<{ newProviderIds?: string[]; initialTab?: "default" | "available" }>).detail;
      const ids = detail?.newProviderIds;
      if (ids && ids.length > 0) {
        setRecentProviderIds(new Set(ids));
      }
      setOpen(true);
    };
    window.addEventListener(openModelPickerEvent, handler);
    return () => window.removeEventListener(openModelPickerEvent, handler);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(pendingModelPickerProviderIdsKey);
      if (!raw) return;
      window.localStorage.removeItem(pendingModelPickerProviderIdsKey);
      const parsed = JSON.parse(raw);
      const ids = Array.isArray(parsed) ? parsed : parsed?.newProviderIds;
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
        setRecentProviderIds(new Set(ids));
      }
      setOpen(true);
    } catch {
      // Ignore malformed pending-picker state.
    }
  }, []);

  // Surface option-load failures when requested. The provider query remains
  // subscribed while the picker is open, so a startup cloud import updates an
  // already-open picker instead of leaving it on the pre-import snapshot.
  useEffect(() => {
    if (providerListQuery.error) {
      onLoadError?.(providerListQuery.error);
    }
  }, [onLoadError, providerListQuery.error]);

  const modelOptions = useMemo(() => {
    const data = providerListQuery.data;
    if (!data?.all) return [];

    // Flag models from recently-added providers so they appear in the
    // "Recently added" section at the top of the picker.
    // Two sources: (1) providers not yet in the localStorage seen-set,
    // (2) providers passed via the openModelPickerEvent from the toast.
    let seenIds: Set<string>;
    try {
      const raw = window.localStorage.getItem("openwork.seenProviderIds");
      seenIds = new Set(raw ? JSON.parse(raw) : []);
    } catch {
      seenIds = new Set();
    }

    const next: ModelOption[] = [];
    for (const provider of getAllProviderItems(data)) {
      const modelIds = Object.keys(provider.models);
      // 未连接且无静态模型清单的 provider 跳过（避免空分组）
      if (!provider.connected && modelIds.length === 0) continue;
      const isNew = !seenIds.has(provider.id) || recentProviderIds.has(provider.id);
      for (const id of modelIds) {
        const model = provider.models[id];
        next.push({
          providerID: provider.id,
          modelID: id,
          title: model.name || id,
          description: provider.name,
          behaviorTitle: "Reasoning",
          behaviorLabel: "Default",
          behaviorDescription: "",
          behaviorValue: null,
          isFree: false,
          isRecommended: isNew,
          connected: provider.connected,
          source: isCloudManagedProviderKey(provider.id) ? "cloud" : undefined,
        });
      }
    }
    return next;
  }, [providerListQuery.data, recentProviderIds]);

  // Apply org-level restrictions (dev #1505) on top of the raw model list
  // so the picker never surfaces blocked options:
  //   - `allowZenModel` hides the built-in OpenCode provider entries when false
  //   - `allowCustomProviders` keeps org-managed providers, plus Zen when allowed.
  const options = useMemo(() => {
    const restrictToCloud = checkDesktopRestriction({
      restriction: "allowCustomProviders",
    });
    return filterEntitledModelOptions(modelOptions, {
      restrictToCloud,
      checkRestriction: checkDesktopRestriction,
    });
  }, [checkDesktopRestriction, modelOptions]);

  // CLI agent 目录（/agent-runtimes）：all models 的 CLI Agents 分组数据。
  // 仅 picker 打开且存在 openwork server client 时拉取，60s 缓存。
  const agentRuntimesQuery = useQuery({
    queryKey: ["openwork-agent-runtimes", openworkServerClient?.baseUrl ?? ""],
    enabled: open && Boolean(openworkServerClient),
    staleTime: 60_000,
    queryFn: async () => {
      if (!openworkServerClient) return [] as CliAgentItem[];
      const res = await openworkServerClient.listAgentRuntimes();
      return (res.capabilities ?? [])
        .filter((cap) => cap.available)
        .map((cap) => ({
          agentId: cap.agentId,
          label: cap.label,
          vendor: cap.vendor,
          protocol: cap.protocol,
          confidence: cap.confidence,
          defaultModel: cap.defaultModel,
        }));
    },
  });
  const cliAgents: CliAgentItem[] = agentRuntimesQuery.data ?? [];

  return {
    open,
    setOpen,
    compactOpen,
    setCompactOpen,
    query,
    setQuery,
    options,
    cliAgents,
    setRecentProviderIds,
  };
}
