/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  MessagesSquare,
  Plus,
  Power,
  RefreshCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  type ImConnectorPlatform,
} from "./im-connector-state";
import { IM_CONNECTOR_DEFINITIONS, type ImConnectorDefinition, useImConnectorStore } from "./im-connector-store";
import { currentLocale, t } from "@/i18n";

// 页面级文案字典（新增文案不触碰全局 locales；跟随当前语言，缺省回退英文）
const PAGE_COPY: Record<string, { en: string; zh: string }> = {
  connect_title: { en: "Connect {name}", zh: "连接 {name}" },
  connect_desc: {
    en: "Fill in the platform webhook URL. Messages sent to this webhook will be relayed to OpenWork Agents.",
    zh: "填写平台的 Webhook URL。发送到该 Webhook 的消息会转交给 OpenWork Agent。",
  },
  webhook_label: { en: "Webhook URL", zh: "Webhook URL" },
  webhook_placeholder: { en: "https://...", zh: "https://..." },
  token_label: { en: "Token (optional)", zh: "Token（可选）" },
  token_placeholder: { en: "Verification token / secret", zh: "校验 Token / 密钥" },
  save: { en: "Save & Connect", zh: "保存并连接" },
  cancel: { en: "Cancel", zh: "取消" },
  webhook_required: { en: "Webhook URL is required.", zh: "请填写 Webhook URL。" },
  connect_failed: { en: "Connection failed. Check the Webhook URL and try again.", zh: "连接失败，请检查 Webhook URL 后重试。" },
};

function pageText(key: string, params?: Record<string, string>): string {
  const locale = currentLocale();
  const entry = PAGE_COPY[key];
  const template = entry ? entry[locale === "zh" ? "zh" : "en"] : key;
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, v);
  return out;
}

interface ImConnectorCardProps {
  definition: ImConnectorDefinition;
  status: "disconnected" | "connecting" | "connected";
  workspace?: string;
  lastSyncAt?: string;
  botName?: string;
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
                {props.workspace ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {props.workspace}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-0.5 text-xs">{props.definition.description}</CardDescription>
            </div>
          </div>
          <Badge variant={formatStatusTone(props.status) as any} className="text-[11px] shrink-0">
            {formatStatusLabel(props.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            {props.lastSyncAt ? (
              <>
                {t("im_connectors.last_sync")}{props.lastSyncAt}
                {props.botName ? <> · {t("im_connectors.bot")}{props.botName}</> : null}
              </>
            ) : props.status === "connected" ? (
              t("im_connectors.connected_ready")
            ) : (
              t("im_connectors.configure_hint")
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {props.status === "connected" ? (
              <>
                <Button variant="ghost" size="icon-sm"                  title={t("im_connectors.resync")} disabled={props.status !== "connected"}>
                  <RefreshCcw className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => props.onDisconnect(props.definition.id)}>
                  <Power className="mr-1.5 size-3.5" />
                  {t("im_connectors.disconnect")}
                </Button>
              </>
            ) : props.status === "connecting" ? (
              <Button size="sm" disabled>
                <RefreshCcw className="mr-1.5 size-3.5 animate-spin" />
                {t("im_connectors.authorizing")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => props.onConnect(props.definition.id)}>
                <Plus className="mr-1.5 size-3.5" />
                {t("im_connectors.connect")}
              </Button>
            )}
            {props.definition.documentationUrl ? (
              <a
                href={props.definition.documentationUrl}
                target="_blank"
                rel="noreferrer"
                title={t("im_connectors.view_docs")}
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
  const store = useImConnectorStore();
  const [connectTarget, setConnectTarget] = useState<ImConnectorPlatform | null>(null);
  const [formWebhook, setFormWebhook] = useState("");
  const [formToken, setFormToken] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.refresh();
  }, []);

  const definitionById = useMemo(() => {
    const map = new Map<ImConnectorPlatform, ImConnectorDefinition>();
    IM_CONNECTOR_DEFINITIONS.forEach((d) => map.set(d.id, d));
    return map;
  }, []);

  const summary = useMemo(() => {
    const connected = store.states.filter((s) => s.status === "connected").length;
    return {
      connected,
      total: store.states.length,
    };
  }, [store.states]);

  const handleConnect = useCallback((id: ImConnectorPlatform) => {
    setConnectTarget(id);
    setFormWebhook("");
    setFormToken("");
    setFormError(null);
  }, []);

  const handleDisconnect = useCallback(
    (id: ImConnectorPlatform) => {
      store.disconnect(id);
    },
    [store],
  );

  const submitConnect = useCallback(async () => {
    if (!connectTarget) return;
    const webhookUrl = formWebhook.trim();
    if (!webhookUrl) {
      setFormError(pageText("webhook_required"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await store.connect(connectTarget, webhookUrl, formToken.trim() || undefined);
      setConnectTarget(null);
    } catch {
      setFormError(pageText("connect_failed"));
    } finally {
      setBusy(false);
    }
  }, [connectTarget, formWebhook, formToken, store]);

  const connectDefinition = connectTarget ? definitionById.get(connectTarget) : undefined;

  return (
    <LayoutStack>
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>
            <MessagesSquare className="size-4 text-primary" />
            {t("im_connectors.title")}
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {t("im_connectors.connected_count", { connected: summary.connected, total: summary.total })}
            </Badge>
          </LayoutSectionTitle>
          <LayoutSectionDescription>
            {t("im_connectors.description")}
          </LayoutSectionDescription>
        </LayoutSectionHeader>
        <LayoutSectionContent>
          <LayoutSectionItem>
            <LayoutSectionItemHeader>
              <LayoutSectionItemTitle>{t("im_connectors.available_platforms")}</LayoutSectionItemTitle>
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Plus className="size-3.5" />
                {t("im_connectors.custom_webhook")}
              </Button>
            </LayoutSectionItemHeader>
            <LayoutSectionItemDescription>
              {t("im_connectors.connect_hint")}
            </LayoutSectionItemDescription>
            <div className="grid gap-3 md:grid-cols-1 xl:grid-cols-2">
              {store.states.map((state) => {
                const definition = definitionById.get(state.id);
                if (!definition) return null;
                return (
                  <ImConnectorCard
                    key={state.id}
                    definition={definition}
                    status={state.status}
                    workspace={state.workspace}
                    lastSyncAt={state.lastSyncAt}
                    botName={state.botName}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                );
              })}
            </div>
          </LayoutSectionItem>
        </LayoutSectionContent>
      </LayoutSection>

      <Dialog
        open={connectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConnectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pageText("connect_title", { name: connectDefinition?.name ?? connectTarget ?? "" })}
            </DialogTitle>
            <DialogDescription>{pageText("connect_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{pageText("webhook_label")}</span>
              <Input
                value={formWebhook}
                onChange={(event) => setFormWebhook(event.target.value)}
                placeholder={pageText("webhook_placeholder")}
                autoFocus
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{pageText("token_label")}</span>
              <Input
                value={formToken}
                onChange={(event) => setFormToken(event.target.value)}
                placeholder={pageText("token_placeholder")}
                type="password"
              />
            </label>
            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={busy} />}>
              {pageText("cancel")}
            </DialogClose>
            <Button onClick={submitConnect} disabled={busy}>
              {busy ? t("im_connectors.authorizing") : pageText("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutStack>
  );
}
