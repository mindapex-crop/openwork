import * as React from "react";
import { Search, Store, Plug, Bot, Sparkles, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkillMarketplacePage } from "../skills/skill-marketplace-page";

type MarketplaceTab = "skills" | "connectors" | "agents";

interface MarketplacePageProps {
  onClose?: () => void;
}

export function MarketplacePage(_props: MarketplacePageProps) {
  const [activeTab, setActiveTab] = React.useState<MarketplaceTab>("skills");
  const [search, setSearch] = React.useState("");

  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4">
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-primary" />
          <h1 className="font-heading text-lg font-medium">Marketplace</h1>
          <span className="text-xs text-muted-foreground">
            能力市场 · Skills · Connectors · Agents
          </span>
        </div>
        <p className="text-sm text-dls-secondary">
          浏览、安装和管理你工作所需的全部能力 —— 从内置技能到外部连接器，再到自定义智能体。
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MarketplaceTab)}
        className="flex-1 overflow-auto"
      >
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <Plug className="size-4" />
            Connectors
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="size-4" />
            Agents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="m-0">
          <SkillMarketplacePage onClose={_props.onClose} />
        </TabsContent>

        <TabsContent value="connectors" className="m-0">
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索 Connectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              已连接的模型、MCP 端点与外部工具
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ConnectorPlaceholderCard
              icon={Bot}
              title="LLM Providers"
              description="已配置的推理模型与供应商（OpenAI, Anthropic, DeepSeek 等）"
              status="已连接"
              count="3"
            />
            <ConnectorPlaceholderCard
              icon={Plug}
              title="MCP Endpoints"
              description="已注册的 MCP 服务端点与工具集合"
              status="已连接"
              count="2"
            />
            <ConnectorPlaceholderCard
              icon={Store}
              title="IM & Workspace"
              description="未来接入：飞书、企业微信、钉钉等消息平台"
              status="即将支持"
              count="0"
            />
          </div>
        </TabsContent>

        <TabsContent value="agents" className="m-0">
          <div className="flex items-center justify-between mb-4 max-w-md">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索 Agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="ml-3 gap-1.5 h-9 shrink-0">
              <Plus className="size-3.5" />
              新建智能体
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border">
            <Bot className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              暂无智能体
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
              创建自定义 Agent，赋予它专属技能、工具和知识，让它替你完成重复任务。
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5 h-9">
              <Plus className="size-3.5" />
              新建智能体
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectorPlaceholderCard({
  icon: Icon,
  title,
  description,
  status,
  count,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  status: string;
  count: string;
}) {
  const isConnected = status === "已连接";
  return (
    <Card className="rounded-xl bg-card/50 hover:bg-card/80 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-4" />
            </div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className="text-xs shrink-0"
          >
            {status} · {count}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-2 leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
