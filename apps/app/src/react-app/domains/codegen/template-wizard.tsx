/** @jsxImportSource react */
import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import { listTemplates, generateFiles } from "./templates";

type TemplateWizardProps = {
  onSelect: (templateId: string) => void;
  onCancel: () => void;
};

export function TemplateWizard({ onSelect, onCancel }: TemplateWizardProps) {
  const templates = listTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate file generation with progress
    const totalSteps = 5;
    for (let step = 1; step <= totalSteps; step++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setGenerationProgress(Math.round((step / totalSteps) * 100));
    }

    // Complete generation
    setIsGenerating(false);
    onSelect(templateId);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            {t("codegen.template_wizard_title")}
          </DialogTitle>
          <DialogDescription>
            {t("codegen.template_wizard_description")}
          </DialogDescription>
        </DialogHeader>

        {!isGenerating ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 hover:shadow-lg"
                onClick={() => handleSelectTemplate(template.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="text-3xl">{template.icon}</div>
                  </div>
                  <CardTitle className="text-base mt-2">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {template.techStack.slice(0, 3).map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                    {template.techStack.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.techStack.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <h3 className="text-lg font-semibold">
                {t("codegen.generating_project")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedTemplate?.name}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("codegen.progress_label")}</span>
                <span>{generationProgress}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-500" />
                <span>{t("codegen.step_analyzing_template")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-500" />
                <span>{t("codegen.step_creating_structure")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-500" />
                <span>{t("codegen.step_generating_files")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-500" />
                <span>{t("codegen.step_configuring_dependencies")}</span>
              </div>
              <div className="flex items-center gap-2">
                {generationProgress === 100 ? (
                  <Check size={14} className="text-emerald-500" />
                ) : (
                  <Loader2 size={14} className="animate-spin" />
                )}
                <span>{t("codegen.step_finalizing")}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isGenerating}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
