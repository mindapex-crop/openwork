/** @jsxImportSource react */
import { useState, type ReactNode } from "react";

import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { ExtensionsView, type ExtensionsViewProps } from "./extensions-view";
import { PluginsView, type PluginsExtensionsStore } from "./plugins-view";

type SuggestedPlugin = {
  name: string;
  packageName: string;
  description: string;
  tags: string[];
  aliases?: string[];
  installMode?: "simple" | "guided";
  steps?: Array<{
    title: string;
    description: string;
    command?: string;
    url?: string;
    path?: string;
    note?: string;
  }>;
};

export type ConnectorsViewProps = {
  busy: boolean;
  selectedWorkspaceRoot: string;
  isRemoteWorkspace: boolean;
  canEditPlugins: boolean;
  canUseGlobalScope: boolean;
  accessHint?: string | null;
  suggestedPlugins: SuggestedPlugin[];
  extensions: PluginsExtensionsStore;
  /** MCP 管理（复用 mcp-view 逻辑，由 settings 路由注入）。 */
  mcpView: ExtensionsViewProps["mcpView"];
  onRefresh: () => void;
  /** IM 连接器（复用 im-connectors-section，由 settings 路由注入）。 */
  imConnectors: ReactNode;
  /** 云 Provider（由 settings 路由注入）。 */
  cloudProviders: ReactNode;
};

type ConnectorTab = "mcp" | "plugins" | "extensions" | "im" | "cloud";

const TABS: Array<{ id: ConnectorTab; labelKey: string }> = [
  { id: "mcp", labelKey: "connectors.tab_mcp" },
  { id: "plugins", labelKey: "connectors.tab_plugins" },
  { id: "extensions", labelKey: "connectors.tab_extensions" },
  { id: "im", labelKey: "connectors.tab_im" },
  { id: "cloud", labelKey: "connectors.tab_cloud" },
];

/**
 * 连接器设置页（WorkBuddy 对标"连接器"模块）：把 MCP 管理、插件、扩展、
 * IM 连接器与云 Provider 聚合到同一个页面，用分组 tab 切换。
 */
export function ConnectorsView(props: ConnectorsViewProps) {
  const [tab, setTab] = useState<ConnectorTab>("mcp");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label={t("connectors.title")}
        className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 pt-2"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              tab === item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "mcp" ? (
          props.mcpView({
            initialFilter: "all",
            onFilterChange: () => {},
            initialState: "all",
            onStateChange: () => {},
            detailId: null,
            onDetailIdChange: undefined,
          })
        ) : tab === "plugins" ? (
          <div className="p-4">
            <PluginsView
              extensions={props.extensions}
              busy={props.busy}
              selectedWorkspaceRoot={props.selectedWorkspaceRoot}
              canEditPlugins={props.canEditPlugins}
              canUseGlobalScope={props.canUseGlobalScope}
              accessHint={props.accessHint}
              suggestedPlugins={props.suggestedPlugins}
            />
          </div>
        ) : tab === "extensions" ? (
          <div className="p-4">
            <ExtensionsView
              busy={props.busy}
              hideDescription
              selectedWorkspaceRoot={props.selectedWorkspaceRoot}
              isRemoteWorkspace={props.isRemoteWorkspace}
              canEditPlugins={props.canEditPlugins}
              canUseGlobalScope={props.canUseGlobalScope}
              accessHint={props.accessHint}
              suggestedPlugins={props.suggestedPlugins}
              extensions={props.extensions}
              mcpView={props.mcpView}
              onRefresh={props.onRefresh}
              showHeader={false}
            />
          </div>
        ) : tab === "im" ? (
          <div className="p-4">{props.imConnectors}</div>
        ) : (
          <div className="p-4">{props.cloudProviders}</div>
        )}
      </div>
    </div>
  );
}
