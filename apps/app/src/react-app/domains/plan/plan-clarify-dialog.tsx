/** @jsxImportSource react */
import { useState } from "react";
import { ChevronRight, Lightbulb, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";

import { usePlanStore } from "./plan-store";
import type { PlanInput } from "./plan-types";
import type { PlanStore } from "./plan-store";

type ClarifyStep = "overview" | "features" | "constraints";

const STEPS: { key: ClarifyStep; labelKey: string }[] = [
  { key: "overview", labelKey: "plan.clarify.step_overview" },
  { key: "features", labelKey: "plan.clarify.step_features" },
  { key: "constraints", labelKey: "plan.clarify.step_constraints" },
];

export type PlanClarifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the initial PlanInput after the user confirms requirements. */
  onGeneratePlan: (input: PlanInput) => void;
};

const EMPTY = "";

const DEFAULT_FEATURES = [
  "User authentication",
  "Data persistence",
  "Responsive UI",
];

export function PlanClarifyDialog({ open, onOpenChange, onGeneratePlan }: PlanClarifyDialogProps) {
  const [step, setStep] = useState<ClarifyStep>("overview");
  const [title, setTitle] = useState<string>(EMPTY);
  const [description, setDescription] = useState<string>(EMPTY);
  const [features, setFeatures] = useState<string[]>([...DEFAULT_FEATURES]);
  const [featureDraft, setFeatureDraft] = useState<string>(EMPTY);
  const [requirements, setRequirements] = useState<string>(EMPTY);
  const [constraints, setConstraints] = useState<string>(EMPTY);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const createPlan = usePlanStore((state: PlanStore) => state.createPlan);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const canAdvance = (() => {
    if (step === "overview") return title.trim().length > 0 && description.trim().length > 0;
    if (step === "features") return features.length > 0;
    return true;
  })();

  const reset = () => {
    setStep("overview");
    setTitle(EMPTY);
    setDescription(EMPTY);
    setFeatures([...DEFAULT_FEATURES]);
    setFeatureDraft(EMPTY);
    setRequirements(EMPTY);
    setConstraints(EMPTY);
    setSuggestedQuestions([]);
    setGenerating(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const addFeature = () => {
    const trimmed = featureDraft.trim();
    if (!trimmed) return;
    setFeatures((prev) => [...prev, trimmed]);
    setFeatureDraft(EMPTY);
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const generateDraftQuestions = (): string[] => {
    const titleLower = title.toLowerCase();
    const questions: string[] = [];
    if (titleLower.includes("api") || titleLower.includes("backend")) {
      questions.push("What authentication mechanism does the API use?");
      questions.push("Are there rate-limiting requirements?");
    }
    if (titleLower.includes("ui") || titleLower.includes("app") || titleLower.includes("page")) {
      questions.push("Which browsers or devices must be supported?");
      questions.push("Is there an existing design system or component library?");
    }
    if (questions.length === 0) {
      questions.push("What does success look like for this project?");
      questions.push("Are there any systems or services this needs to integrate with?");
    }
    questions.push("What is the expected scale (users, data volume)?");
    return questions;
  };

  const handleNext = () => {
    if (step === "overview") {
      setStep("features");
      setSuggestedQuestions(generateDraftQuestions());
    } else if (step === "features") {
      setStep("constraints");
    }
  };

  const handleBack = () => {
    if (step === "constraints") setStep("features");
    else if (step === "features") setStep("overview");
  };

  const handleGenerate = () => {
    setGenerating(true);
    const input: PlanInput = {
      title: title.trim(),
      description: description.trim(),
      requirements: [
        `## Key Features`,
        ...features.map((f) => `- ${f}`),
        EMPTY,
        `## Constraints & Requirements`,
        constraints.trim() || requirements.trim() || "None specified.",
      ].join("\n"),
      technicalApproach: "To be defined during the plan editing phase.",
      tasks: [],
    };
    // Persist the plan locally so the editor can pick it up.
    createPlan(input);
    setGenerating(false);
    onGeneratePlan(input);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-blue-10" />
            <DialogTitle>{t("plan.clarify.title")}</DialogTitle>
          </div>
          <DialogDescription>{t("plan.clarify.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* Phase indicator */}
        <div className="flex items-center gap-2 px-1">
          {STEPS.map((s, index) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                  index <= currentStepIndex
                    ? "bg-blue-9 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`text-[12px] ${
                  index === currentStepIndex ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {t(s.labelKey)}
              </span>
              {index < STEPS.length - 1 && (
                <ChevronRight className="size-3 text-muted-foreground/50" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[200px] space-y-4">
          {step === "overview" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  {t("plan.clarify.title_label")}
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("plan.clarify.title_placeholder")}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  {t("plan.clarify.description_label")}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("plan.clarify.description_placeholder")}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          {step === "features" && (
            <div className="space-y-3">
              <label className="block text-[13px] font-medium text-foreground">
                {t("plan.clarify.features_label")}
              </label>
              <div className="flex gap-2">
                <Input
                  value={featureDraft}
                  onChange={(e) => setFeatureDraft(e.target.value)}
                  placeholder={t("plan.clarify.feature_placeholder")}
                  className="h-9 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={addFeature}>
                  {t("plan.clarify.add")}
                </Button>
              </div>
              <ul className="space-y-1.5">
                {features.map((feature, index) => (
                  <li
                    key={`${feature}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[13px]"
                  >
                    <span className="text-foreground">{feature}</span>
                    <button
                      type="button"
                      className="text-muted-foreground/60 hover:text-foreground"
                      onClick={() => removeFeature(index)}
                      aria-label={t("plan.clarify.remove_feature")}
                    >
                      <Sparkles className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {suggestedQuestions.length > 0 && (
                <div className="rounded-lg border border-blue-7/30 bg-blue-2/30 p-3">
                  <p className="mb-1.5 text-[12px] font-medium text-blue-11">
                    {t("plan.clarify.suggested_questions")}
                  </p>
                  <ul className="space-y-1">
                    {suggestedQuestions.slice(0, 3).map((q) => (
                      <li key={q} className="text-[12px] text-blue-10">
                        • {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "constraints" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  {t("plan.clarify.constraints_label")}
                </label>
                <Textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder={t("plan.clarify.constraints_placeholder")}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  {t("plan.clarify.requirements_label")}
                </label>
                <Textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={t("plan.clarify.requirements_placeholder")}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div>
              {currentStepIndex > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                  {t("plan.clarify.back")}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                {t("plan.clarify.cancel")}
              </Button>
              {currentStepIndex < STEPS.length - 1 ? (
                <Button type="button" size="sm" disabled={!canAdvance} onClick={handleNext}>
                  {t("plan.clarify.next")}
                  <ChevronRight className="ms-1 size-3.5" />
                </Button>
              ) : (
                <Button type="button" size="sm" disabled={generating} onClick={handleGenerate}>
                  {generating && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
                  {t("plan.clarify.generate_plan")}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
