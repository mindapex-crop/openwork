/** @jsxImportSource react */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clipboard, Download, Plus } from "lucide-react";
import { parseTranscript, type ParsedNotes, type ActionItem } from "./transcription-parser";
import { useProjectStore } from "../../domains/projects/project-store";
import { t } from "@/i18n";

interface NotesExtractorProps {
  transcript: string;
  projectId?: string;
}

export function NotesExtractor({ transcript, projectId }: NotesExtractorProps) {
  const notes = useMemo(() => parseTranscript(transcript), [transcript]);
  const addTask = useProjectStore((state) => state.addTask);

  const formatAsMarkdown = (parsedNotes: ParsedNotes): string => {
    const lines: string[] = [];

    if (parsedNotes.summary) {
      lines.push("# Meeting Summary\n");
      lines.push(parsedNotes.summary);
      lines.push("");
    }

    if (parsedNotes.topics.length > 0) {
      lines.push("## Topics Discussed\n");
      for (const topic of parsedNotes.topics) {
        lines.push(`- ${topic}`);
      }
      lines.push("");
    }

    if (parsedNotes.decisions.length > 0) {
      lines.push("## Decisions Made\n");
      for (const decision of parsedNotes.decisions) {
        lines.push(`- ✓ ${decision}`);
      }
      lines.push("");
    }

    if (parsedNotes.actionItems.length > 0) {
      lines.push("## Action Items\n");
      for (const item of parsedNotes.actionItems) {
        const dueDate = item.dueDate ? ` (due: ${item.dueDate})` : "";
        lines.push(`- [ ] **${item.assignee}**: ${item.task}${dueDate}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  };

  const handleCopyToClipboard = async () => {
    const markdown = formatAsMarkdown(notes);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleExportAsMarkdown = () => {
    const markdown = formatAsMarkdown(notes);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-notes-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateTasks = () => {
    if (!projectId || notes.actionItems.length === 0) {
      return;
    }

    // Get the first plan in the project (or create a default one)
    // For now, we'll just add tasks to a placeholder plan ID
    // In real usage, this would need proper plan selection
    const planId = "default";

    for (const item of notes.actionItems) {
      const taskTitle = `[${item.assignee}] ${item.task}${item.dueDate ? ` (due: ${item.dueDate})` : ""}`;
      addTask(projectId, planId, taskTitle);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
          <Clipboard className="h-4 w-4 mr-2" />
          {t("meeting.copy_to_clipboard") as string}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportAsMarkdown}>
          <Download className="h-4 w-4 mr-2" />
          {t("meeting.export_as_markdown") as string}
        </Button>
        {projectId && notes.actionItems.length > 0 && (
          <Button variant="default" size="sm" onClick={handleCreateTasks}>
            <Plus className="h-4 w-4 mr-2" />
            {t("meeting.create_tasks") as string}
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          {notes.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("meeting.summary") as string}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{notes.summary}</p>
              </CardContent>
            </Card>
          )}

          {notes.topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("meeting.topics_discussed") as string}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {notes.topics.map((topic, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {topic}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {notes.decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("meeting.decisions_made") as string}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {notes.decisions.map((decision, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{decision}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {notes.actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("meeting.action_items") as string}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {notes.actionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Checkbox id={`action-${index}`} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <label htmlFor={`action-${index}`} className="text-sm font-medium">
                            {item.assignee}
                          </label>
                          {item.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {t("meeting.due_date") as string}: {item.dueDate}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.task}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {notes.topics.length === 0 &&
            notes.decisions.length === 0 &&
            notes.actionItems.length === 0 && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-sm text-muted-foreground">
                    {t("meeting.no_content_found") as string}
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}
