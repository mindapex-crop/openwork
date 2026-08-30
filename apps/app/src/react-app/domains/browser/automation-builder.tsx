/** @jsxImportSource react */
import { useState, useEffect } from "react";
import { Plus, Trash2, Play, Save, FolderOpen, ArrowUp, ArrowDown, CheckCircle2, Circle, XCircle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type AutomationAction =
  | "navigate"
  | "click"
  | "fill"
  | "screenshot"
  | "extract"
  | "wait";

export interface AutomationStep {
  id: string;
  action: AutomationAction;
  params: Record<string, string>;
}

export interface AutomationScript {
  name: string;
  steps: AutomationStep[];
  createdAt: number;
  updatedAt: number;
}

const ACTION_LABELS: Record<AutomationAction, string> = {
  navigate: "Navigate to URL",
  click: "Click Element",
  fill: "Fill Form Field",
  screenshot: "Take Screenshot",
  extract: "Extract Text",
  wait: "Wait for Element",
};

const STORAGE_KEY = "openwork-browser-scripts";

function loadScripts(): AutomationScript[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveScripts(scripts: AutomationScript[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch (error) {
    console.error("Failed to save scripts:", error);
    toast.error("保存失败：存储空间可能已满");
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface StepExecutionResult {
  status: "pending" | "running" | "success" | "error";
  message?: string;
}

export function AutomationBuilder() {
  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [scriptName, setScriptName] = useState("");
  const [executionResults, setExecutionResults] = useState<Record<string, StepExecutionResult>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [savedScripts, setSavedScripts] = useState<AutomationScript[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  useEffect(() => {
    setSavedScripts(loadScripts());
  }, []);

  const addStep = () => {
    const newStep: AutomationStep = {
      id: generateId(),
      action: "navigate",
      params: {},
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((step) => step.id !== id));
    setExecutionResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const updateStepAction = (id: string, action: AutomationAction) => {
    setSteps(steps.map((step) => (step.id === id ? { ...step, action, params: {} } : step)));
  };

  const updateStepParam = (id: string, key: string, value: string) => {
    setSteps(
      steps.map((step) =>
        step.id === id ? { ...step, params: { ...step.params, [key]: value } } : step,
      ),
    );
  };

  const validateSteps = (): boolean => {
    for (const step of steps) {
      switch (step.action) {
        case "navigate":
          if (!step.params.url) {
            toast.error("请为所有 Navigate 步骤填写 URL");
            return false;
          }
          break;
        case "click":
        case "extract":
        case "wait":
          if (!step.params.selector) {
            toast.error("请为所有 Click/Extract/Wait 步骤填写 CSS Selector");
            return false;
          }
          break;
        case "fill":
          if (!step.params.selector || !step.params.value) {
            toast.error("请为所有 Fill 步骤填写 Selector 和 Value");
            return false;
          }
          break;
      }
    }
    return true;
  };

  const executeStep = async (step: AutomationStep): Promise<StepExecutionResult> => {
    // Simulate step execution - in production this would call the actual skill
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      switch (step.action) {
        case "navigate":
          return { status: "success", message: `Navigated to ${step.params.url}` };
        case "click":
          return { status: "success", message: `Clicked element: ${step.params.selector}` };
        case "fill":
          return { status: "success", message: `Filled ${step.params.selector} with value` };
        case "screenshot":
          return { status: "success", message: "Screenshot captured" };
        case "extract":
          return { status: "success", message: `Extracted text from ${step.params.selector}` };
        case "wait":
          return { status: "success", message: `Waited for element: ${step.params.selector}` };
        default:
          return { status: "error", message: "Unknown action" };
      }
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Execution failed" };
    }
  };

  const runAutomation = async () => {
    if (steps.length === 0) {
      toast.error("请先添加至少一个步骤");
      return;
    }

    if (!validateSteps()) {
      return;
    }

    setIsExecuting(true);
    const results: Record<string, StepExecutionResult> = {};

    for (const step of steps) {
      results[step.id] = { status: "running" };
      setExecutionResults({ ...results });

      const result = await executeStep(step);
      results[step.id] = result;
      setExecutionResults({ ...results });

      if (result.status === "error") {
        toast.error(`步骤执行失败: ${result.message}`);
        break;
      }
    }

    setIsExecuting(false);
    const successCount = Object.values(results).filter((r) => r.status === "success").length;
    toast.success(`自动化执行完成: ${successCount}/${steps.length} 步成功`);
  };

  const saveScript = () => {
    if (!scriptName.trim()) {
      toast.error("请输入脚本名称");
      return;
    }

    if (steps.length === 0) {
      toast.error("请添加至少一个步骤");
      return;
    }

    const script: AutomationScript = {
      name: scriptName.trim(),
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existingIndex = savedScripts.findIndex((s) => s.name === script.name);
    let updatedScripts: AutomationScript[];

    if (existingIndex >= 0) {
      updatedScripts = [...savedScripts];
      updatedScripts[existingIndex] = script;
      toast.success(`脚本 "${script.name}" 已更新`);
    } else {
      updatedScripts = [...savedScripts, script];
      toast.success(`脚本 "${script.name}" 已保存`);
    }

    setSavedScripts(updatedScripts);
    saveScripts(updatedScripts);
  };

  const loadScript = (script: AutomationScript) => {
    setScriptName(script.name);
    setSteps(script.steps);
    setExecutionResults({});
    setLoadDialogOpen(false);
    toast.success(`已加载脚本: ${script.name}`);
  };

  const clearAll = () => {
    setSteps([]);
    setScriptName("");
    setExecutionResults({});
    toast.info("已清空所有内容");
  };

  const renderStepParams = (step: AutomationStep) => {
    switch (step.action) {
      case "navigate":
        return (
          <div className="space-y-2">
            <Label htmlFor={`url-${step.id}`}>URL</Label>
            <Input
              id={`url-${step.id}`}
              placeholder="https://example.com"
              value={step.params.url || ""}
              onChange={(e) => updateStepParam(step.id, "url", e.target.value)}
            />
          </div>
        );
      case "click":
      case "extract":
      case "wait":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor={`selector-${step.id}`}>CSS Selector</Label>
              <Input
                id={`selector-${step.id}`}
                placeholder="#button-id or .class-name"
                value={step.params.selector || ""}
                onChange={(e) => updateStepParam(step.id, "selector", e.target.value)}
              />
            </div>
            {step.action === "wait" && (
              <div className="space-y-2 mt-2">
                <Label htmlFor={`timeout-${step.id}`}>Timeout (ms)</Label>
                <Input
                  id={`timeout-${step.id}`}
                  type="number"
                  placeholder="5000"
                  value={step.params.timeout || ""}
                  onChange={(e) => updateStepParam(step.id, "timeout", e.target.value)}
                />
              </div>
            )}
          </>
        );
      case "fill":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor={`selector-${step.id}`}>CSS Selector</Label>
              <Input
                id={`selector-${step.id}`}
                placeholder="#input-id or .input-class"
                value={step.params.selector || ""}
                onChange={(e) => updateStepParam(step.id, "selector", e.target.value)}
              />
            </div>
            <div className="space-y-2 mt-2">
              <Label htmlFor={`value-${step.id}`}>Value</Label>
              <Input
                id={`value-${step.id}`}
                placeholder="Text to fill"
                value={step.params.value || ""}
                onChange={(e) => updateStepParam(step.id, "value", e.target.value)}
              />
            </div>
          </>
        );
      case "screenshot":
        return (
          <div className="space-y-2">
            <Label htmlFor={`filename-${step.id}`}>Filename (optional)</Label>
            <Input
              id={`filename-${step.id}`}
              placeholder="screenshot.png"
              value={step.params.filename || ""}
              onChange={(e) => updateStepParam(step.id, "filename", e.target.value)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const getStepIcon = (status?: StepExecutionResult) => {
    if (!status) return <Circle className="size-4 text-muted-foreground" />;
    if (status.status === "running") return <Clock className="size-4 text-blue-500 animate-pulse" />;
    if (status.status === "success") return <CheckCircle2 className="size-4 text-green-500" />;
    if (status.status === "error") return <XCircle className="size-4 text-red-500" />;
    return <Circle className="size-4 text-muted-foreground" />;
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Input
            placeholder="脚本名称..."
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex gap-2">
          <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogTrigger>
              <Button variant="outline" size="sm">
                <FolderOpen className="size-4 mr-2" />
                加载
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>加载已保存的脚本</DialogTitle>
                <DialogDescription>选择之前保存的浏览器自动化脚本</DialogDescription>
              </DialogHeader>
              {savedScripts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无已保存的脚本
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {savedScripts.map((script) => (
                      <Card
                        key={script.name}
                        className="cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => loadScript(script)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{script.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {script.steps.length} 个步骤 · 更新于{" "}
                                {new Date(script.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">
                              加载
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
                  关闭
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={saveScript}>
            <Save className="size-4 mr-2" />
            保存
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="size-4 mr-2" />
            清空
          </Button>
          <Button
            size="sm"
            onClick={runAutomation}
            disabled={isExecuting || steps.length === 0}
          >
            <Play className="size-4 mr-2" />
            {isExecuting ? "执行中..." : "运行自动化"}
          </Button>
        </div>
      </div>

      {/* Steps List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {steps.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  还没有添加任何步骤。点击下方按钮开始构建自动化脚本。
                </p>
                <Button onClick={addStep}>
                  <Plus className="size-4 mr-2" />
                  添加第一个步骤
                </Button>
              </CardContent>
            </Card>
          ) : (
            steps.map((step, index) => {
              const result = executionResults[step.id];
              return (
                <Card key={step.id} className={result?.status === "running" ? "border-blue-500" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-2">
                          {getStepIcon(result)}
                          <Badge variant="outline" className="text-xs">
                            步骤 {index + 1}
                          </Badge>
                        </div>
                        <Select
                          value={step.action}
                          onValueChange={(value) => updateStepAction(step.id, value as AutomationAction)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ACTION_LABELS) as AutomationAction[]).map((action) => (
                              <SelectItem key={action} value={action}>
                                {ACTION_LABELS[action]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveStep(index, "up")}
                          disabled={index === 0 || isExecuting}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveStep(index, "down")}
                          disabled={index === steps.length - 1 || isExecuting}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(step.id)}
                          disabled={isExecuting}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {renderStepParams(step)}
                    {result?.message && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          {result.status === "success" ? "✓ " : result.status === "error" ? "✗ " : ""}
                          {result.message}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      {steps.length > 0 && (
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            共 {steps.length} 个步骤
          </p>
          <Button variant="outline" size="sm" onClick={addStep} disabled={isExecuting}>
            <Plus className="size-4 mr-2" />
            添加步骤
          </Button>
        </div>
      )}
    </div>
  );
}
