import * as React from "react";
import { CheckSquare, Users, Tag, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseTranscript, isMeetingTranscript, type ParsedNotes } from "./transcription-parser";

interface MeetingNotesExtractorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string;
  onSave?: (notes: ParsedNotes) => void;
}

export function MeetingNotesExtractor({
  open,
  onOpenChange,
  initialText = "",
  onSave,
}: MeetingNotesExtractorProps) {
  const [text, setText] = React.useState(initialText);
  const [notes, setNotes] = React.useState<ParsedNotes | null>(null);

  React.useEffect(() => {
    if (initialText && open) {
      setText(initialText);
      if (isMeetingTranscript(initialText)) {
        setNotes(parseTranscript(initialText));
      } else {
        setNotes(null);
      }
    }
  }, [initialText, open]);

  const handleExtract = () => {
    if (text.trim()) {
      const parsed = parseTranscript(text);
      setNotes(parsed);
    }
  };

  const handleSave = () => {
    if (notes) {
      onSave?.(notes);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meeting Notes Extractor</DialogTitle>
          <DialogDescription>
            Paste your meeting transcript to automatically extract topics, decisions, and action items.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!notes ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Paste Transcript</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Example:&#10;[10:00] Alice: Let's discuss the Q1 roadmap&#10;[10:05] Bob: I think we should prioritize mobile app&#10;DECISION: Focus on iOS first&#10;ACTION: @Alice will create wireframes by Friday"
                rows={10}
                className="font-mono text-sm"
              />
              <Button onClick={handleExtract} disabled={!text.trim()}>
                Extract Notes
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">{notes.summary}</p>
              </div>

              {/* Topics */}
              {notes.topics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Topics ({notes.topics.length})</h3>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {notes.topics.map((topic, i) => (
                      <li key={i} className="text-sm text-gray-700">• {topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decisions */}
              {notes.decisions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Decisions ({notes.decisions.length})</h3>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {notes.decisions.map((decision, i) => (
                      <li key={i} className="text-sm text-gray-700">✓ {decision}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {notes.actionItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Action Items ({notes.actionItems.length})</h3>
                  </div>
                  <ul className="space-y-2 ml-6">
                    {notes.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="font-medium">@{item.assignee}</span>
                        <span>{item.task}</span>
                        {item.dueDate && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto">
                            <Calendar className="h-3 w-3" />
                            {item.dueDate}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave}>Save Notes</Button>
                <Button variant="outline" onClick={() => setNotes(null)}>
                  Edit Transcript
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
