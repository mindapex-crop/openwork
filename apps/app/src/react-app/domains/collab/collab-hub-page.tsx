/** @jsxImportSource react */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Sparkles, Users } from "lucide-react";

import { readDenSettings } from "@/app/lib/den";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { runSimpleCollab, type RunSimpleCollabResult } from "./collab-api";

export type CollabHubPageProps = {
  onClose?: () => void;
};

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "progress"; result: RunSimpleCollabResult }
  | { phase: "error"; message: string; noAgent: boolean };

const PLACEHOLDER = t("collab.placeholder");

function isCompleted(status: string) {
  return status === "completed" || status === "done" || status === "succeeded";
}

function isRunning(status: string) {
  return status === "running" || status === "in_progress" || status === "pending" || status === "queued";
}

function subtaskBadgeClass(status: string) {
  if (isCompleted(status)) return "bg-emerald-500/10 text-emerald-600";
  if (status === "failed") return "bg-red-500/10 text-red-600";
  if (isRunning(status)) return "bg-sky-500/10 text-sky-500 animate-pulse";
  return "bg-gray-500/10 text-gray-500";
}

function subtaskBadgeLabel(status: string) {
  switch (status) {
    case "completed":
    case "done":
    case "succeeded":
      return t("collab.status_completed");
    case "failed":
      return t("collab.status_failed");
    case "running":
      return t("collab.status_running");
    case "pending":
    case "queued":
      return t("collab.status_pending");
    default:
      return status;
  }
}

/**
 * Standalone proxy for "have a usable AI model / collab provider configured".
 * A routed page can't synchronously read the connected-provider list (it lives
 * on the session route), so we fall back to the signal the collab orchestrator
 * actually needs: the control plane (OpenWork / provider gateway) being signed
 * in. This mirrors the "key provider connected" check, not the full
 * `hasOpenWorkModelsAvailable` model scan.
 */
function hasConfiguredCollabModel() {
  return Boolean(readDenSettings().authToken?.trim());
}

/** `/settings/ai` (AI & models config) honoring an active workspace prefix. */
function settingsModelsPath(pathname: string) {
  const workspace = /^(\/workspace\/[^/]+)\/settings/.exec(pathname)?.[1];
  return workspace ? `${workspace}/settings/ai` : "/settings/ai";
}

function StrategyBadge({ strategy }: { strategy: string }) {
  if (!strategy) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[12px] font-medium text-violet-600">
      <Sparkles className="size-3" />
      {t("collab.strategy", { strategy })}
    </span>
  );
}

export function CollabHubPage(props: CollabHubPageProps) {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const navigate = useNavigate();
  const location = useLocation();
  const [needsModelConfig] = useState(() => !hasConfiguredCollabModel());

  const submitting = state.phase === "submitting";

  const handleGoConfigure = () => {
    props.onClose?.();
    void navigate(settingsModelsPath(location.pathname));
  };

  const handleSubmit = async () => {
    const prompt = draft.trim();
    if (!prompt || submitting) return;
    if (!hasConfiguredCollabModel()) {
      setState({
        phase: "error",
        message: t("collab.no_model_title"),
        noAgent: true,
      });
      return;
    }
    setState({ phase: "submitting" });
    const outcome = await runSimpleCollab(prompt);
    if (outcome.ok) {
      setState({ phase: "progress", result: outcome.data });
    } else if (outcome.kind === "no_agent_available") {
      setState({ phase: "error", message: t("collab.no_agent_hint"), noAgent: true });
    } else {
      setState({ phase: "error", message: outcome.message, noAgent: false });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-stretch gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-foreground">
          {t("collab.title")}
        </h2>
        <p className="text-[13px] text-muted-foreground">{t("collab.subtitle")}</p>
      </div>

      {state.phase !== "progress" ? (
        <Card variant="default" className="gap-4">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles className="size-4 text-violet-500" />
              {t("collab.assign_title")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {t("collab.assign_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {needsModelConfig ? (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <p className="text-[12px] leading-[17px] text-foreground">
                    {t("collab.no_model_title")}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={handleGoConfigure}>
                  {t("collab.go_configure")}
                </Button>
              </div>
            ) : null}
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={PLACEHOLDER}
              disabled={submitting}
              rows={5}
              className="min-h-32"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
            <div className="mt-4 flex justify-end">
              <Button
                size="lg"
                onClick={() => void handleSubmit()}
                disabled={submitting || !draft.trim()}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {submitting ? t("collab.submitting") : t("collab.submit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "progress" ? <ProgressPanel result={state.result} /> : null}

      {state.phase === "error" ? (
        <Card variant="outline" className="gap-3 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className={cn("mt-0.5 size-5 shrink-0", state.noAgent ? "text-amber-500" : "text-red-500")} />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-foreground">
                {state.noAgent ? t("collab.no_agent_title") : t("collab.failed")}
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {state.noAgent ? t("collab.no_agent_hint") : state.message}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setState({ phase: "idle" })}>
                  {t("collab.back")}
                </Button>
                {props.onClose ? (
                  <Button variant="outline" size="sm" onClick={props.onClose}>
                    {t("collab.open_settings")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ProgressPanel({ result }: { result: RunSimpleCollabResult }) {
  const completed = isCompleted(result.status);
  return (
    <Card variant="default" className="gap-4">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          {completed ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Loader2 className="size-4 animate-spin text-sky-500" />
          )}
          {t("collab.progress_title")}
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-[12px]">
          {(result.subtasks?.length ?? 0) > 0 ? (
            <>{t("collab.subtasks_assigned", { count: result.subtasks.length })}</>
          ) : (
            <>{t("collab.team_preparing")}</>
          )}
          <StrategyBadge strategy={result.strategy} />
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {result.subtasks && result.subtasks.length > 0 ? (
          <ul className="space-y-2">
            {result.subtasks.map((subtask, index) => (
              <li
                key={`${subtask.agentId}-${index}`}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {subtask.agentId || t("collab.agent_fallback")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        subtaskBadgeClass(subtask.status),
                      )}
                    >
                      {subtaskBadgeLabel(subtask.status)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-[17px] text-muted-foreground">
                    {subtask.prompt}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/60" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-sky-500" />
            <p className="text-[13px] text-muted-foreground">{t("collab.plan_generating")}</p>
          </div>
        )}

        {completed ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-[13px] font-medium text-emerald-600">
            <CheckCircle2 className="size-4" />
            {t("collab.completed")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}