/** @jsxImportSource react */
import { useMemo, useState } from "react";
import {
  Cloud,
  ExternalLink,
  MessageSquare,
  MessagesSquare,
  Plus,
  Power,
  RefreshCcw,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LayoutSection,
  LayoutSectionContent,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemHeader,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
  LayoutStack,
} from "./settings-layout";
import {
  formatStatusLabel,
  formatStatusTone,
} from "./im-connector-state";

type ImConnectorPlatform = "feishu" | "wecom" | "dingtalk" | "slack" | "discord";

type ImConnectorStatus = "disconnected" | "connecting" | "connected";

interface ImConnectorDefinition {
  id: ImConnectorPlatform;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  documentationUrl?: string;
  accent: string;
}

interface ImConnectorState {
  id: ImConnectorPlatform;
  status: ImConnectorStatus;
  workspace?: string;
  botName?: string;
  lastSyncAt?: string;
}

const DEFINITIONS: ImConnectorDefinition[] = [
  {
    id: "feishu",
    name: "飞书",
    description: "通过飞书机器人接收消息、创建任务与回复通知。",
    icon: MessagesSquare,
    documentationUrl: "https://open.feishu.cn/",
    accent: "bg-indigo-500",
  },
  {
    id: "wecom",
    name: "企业微信",
    description: "接入企业微信应用，在内部群中启动 Agent 会话。",
    icon: MessageSquare,
    documentationUrl: "https://developer.work.weixin.qq.com/",
    accent: "bg-sky-500",
  },
  {
    id: "dingtalk",
    name: "钉钉",
    description: "通过钉钉连接器在群聊与工作通知中推送产物。",
    icon: Send,
    documentationUrl: "https://open.dingtalk.com/",
    accent: "bg-violet-500",
  },
  {
    id: "slack",
    name: "Slack",
    description: "在 Slack 频道中与 OpenWork Agent 对话。",
    icon: Cloud,
    documentationUrl: "https://api.slack.com/",
    accent: "bg-rose-500",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Discord Bot 集成：创建专属技能频道。",
    icon: MessageSquare,
    documentationUrl: "https://discord.com/developers",
    accent: "bg-indigo-600",
  },
];

const LOCAL_INITIAL_STATES: ImConnectorState[] = [
  { id: "feishu", status: "disconnected" },
  { id: "wecom", status: "disconnected" },
  { id: "dingtalk", status: "disconnected" },
  { id: "slack", status: "disconnected" },
  { id: "discord", status: "disconnected" },
];

interface ImConnectorCardProps {
  definition: ImConnectorDefinition;
  state: ImConnectorState;
  onConnect: (id: ImConnectorPlatform) => void;
  onDisconnect: (id: ImConnectorPlatform) => void;
}

function ImConnectorCard(props: ImConnectorCardProps) {
  const ConnectorIcon = props.definition.icon;
  return (
    <Card className="rounded-xl bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={props.definition.accent + " flex size-10 items-center justify-center rounded-xl text-white"}>
              <ConnectorIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">{props.definition.name}</CardTitle>
                {props.state.workspace ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {props.state.workspace}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-0.5 text-xs">{props.definition.description}</CardDescription>
            </div>
          </div>
          <Badge variant={formatStatusTone(props.state.status) as any} className="text-[11px] shrink-0">
            {formatStatusLabel(props.state.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            {props.state.lastSyncAt ? (
              <>
                最近同步：{props.state.lastSyncAt}
                {props.state.botName ? <> · 机器人：{props.state.botName}</> : null}
              </>
            ) : props.state.status === "connected" ? (
              "连接已就绪，可在 IM 中直接 @机器人发起任务。"
            ) : (
              "配置应用凭证后即可完成接入。"
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {props.state.status === "connected" ? (
              <>
                <Button variant="ghost" size="icon-sm" title="重新同步" disabled={props.state.status !== "connected"}>
                  <RefreshCcw className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => props.onDisconnect(props.definition.id)}>
                  <Power className="mr-1.5 size-3.5" />
                  断开
                </Button>
              </>
            ) : props.state.status === "connecting" ? (
              <Button size="sm" disabled>
                <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                授权中...
              </Button>
            ) : (
              <Button size="sm" onClick={() => props.onConnect(props.definition.id)}>
                <Plus className="mr-1.5 size-3.5" />
                连接
              </Button>
            )}
            {props.definition.documentationUrl ? (
              <a
                href={props.definition.documentationUrl}
                target="_blank"
                rel="noreferrer"
                title="查看文档"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ImConnectorsSection() {
  const [states, setStates] = useState<ImConnectorState[]>(LOCAL_INITIAL_STATES);

  const definitionById = useMemo(() => {
    const map = new Map<ImConnectorPlatform, ImConnectorDefinition>();
    DEFINITIONS.forEach((d) => map.set(d.id, d));
    return map;
  }, []);

  const summary = useMemo(() => {
    const connected = states.filter((s) => s.status === "connected").length;
    return {
      connected,
      total: states.length,
    };
  }, [states]);

  const handleConnect = (id: ImConnectorPlatform) => {
    setStates((prev) => prev.map((s) => (s.id === id ? { ...s, status: "connecting" } : s)));
    window.setTimeout(() => {
      setStates((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const now = new Date();
          const iso = now.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return {
            ...s,
            status: "connected",
            workspace: id === "feishu" ? "OpenWork 工作区" : "Demo Team",
            botName: "OpenWork Bot",
            lastSyncAt: iso,
          };
        }),
      );
    }, 900);
  };

  const handleDisconnect = (id: ImConnectorPlatform) => {
    setStates((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return { id, status: "disconnected" };
      }),
    );
  };

  return (
    <LayoutStack>
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>
            <MessagesSquare className="size-4 text-primary" />
            IM 集成
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {summary.connected} / {summary.total} 已连接
            </Badge>
          </LayoutSectionTitle>
          <LayoutSectionDescription>
            将 OpenWork Agent 接入消息平台，让团队成员可以在日常聊天里与 Agent 对话，将任务、产物、审批直接推送到你所在的频道与工作群。
          </LayoutSectionDescription>
        </LayoutSectionHeader>
        <LayoutSectionContent>
          <LayoutSectionItem>
            <LayoutSectionItemHeader>
              <LayoutSectionItemTitle>可用的平台</LayoutSectionItemTitle>
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Plus className="size-3.5" />
                自定义 Webhook (即将支持)
              </Button>
            </LayoutSectionItemHeader>
            <LayoutSectionItemDescription>
              点击下方“连接”按钮跳转到对应平台的授权页面，完成后即可在 OpenWork 中查看状态并管理连接。
            </LayoutSectionItemDescription>
            <div className="grid gap-3 md:grid-cols-1 xl:grid-cols-2">
              {states.map((state) => {
                const definition = definitionById.get(state.id);
                if (!definition) return null;
                return (
                  <ImConnectorCard
                    key={state.id}
                    definition={definition}
                    state={state}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                );
              })}
            </div>
          </LayoutSectionItem>
        </LayoutSectionContent>
      </LayoutSection>
    </LayoutStack>
  );
}
