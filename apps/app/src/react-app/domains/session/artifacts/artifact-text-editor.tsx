/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markdownLivePreview } from "./markdown-live-preview";
import { RichTextEditor, htmlToMarkdown, markdownToHtml } from "../../editor/rich-text-editor";
import { isMeetingTranscript } from "../../meeting/transcription-parser";
import { NotesExtractor } from "../../meeting/notes-extractor";

const LINE_PREFIX_PATTERN = /^(#{1,6}\s+|>\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/;

function setLinePrefix(view: EditorView, prefix: string | ((index: number) => string)) {
  const { state } = view;
  const { from, to } = state.selection.main;
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  const changes = [];

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
    const line = state.doc.line(lineNumber);
    const existing = LINE_PREFIX_PATTERN.exec(line.text);
    const insert = typeof prefix === "function" ? prefix(lineNumber - startLine) : prefix;

    changes.push({ from: line.from, to: line.from + (existing ? existing[0].length : 0), insert });
  }

  view.dispatch({ changes });
  view.focus();
}

function wrapSelection(view: EditorView, marker: string) {
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to);

  view.dispatch({
    changes: { from, to, insert: `${marker}${text}${marker}` },
    selection: { anchor: from + marker.length, head: to + marker.length },
  });
  view.focus();
}

type ArtifactTextEditorProps = {
  className?: string;
  value: string;
  language: "markdown" | "text";
  onChange: (value: string) => void;
};

export function ArtifactTextEditor(props: ArtifactTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(props.onChange);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const isTranscript = isMeetingTranscript(props.value);

  // For markdown language, use RichTextEditor
  if (props.language === "markdown") {
    return (
      <div className="relative h-full">
        <RichTextEditor
          value={props.value}
          onChange={(html) => {
            // Convert HTML back to markdown for storage
            const markdown = htmlToMarkdown(html);
            props.onChange(markdown);
          }}
          className={cn("h-full min-h-0 overflow-hidden", props.className)}
        />
        {isTranscript && (
          <div className="absolute top-2 right-2 z-10">
            <Button variant="outline" size="sm" onClick={() => setShowMeetingNotes(true)}>
              Extract Meeting Notes
            </Button>
            <Dialog open={showMeetingNotes} onOpenChange={setShowMeetingNotes}>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Meeting Notes</DialogTitle>
                </DialogHeader>
                <NotesExtractor transcript={props.value} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    );
  }

  // For text language, use CodeMirror editor
  useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": { height: "100%", background: "transparent" },
            ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
            ".cm-content": { minHeight: "100%", padding: "12px 0", fontSize: "12px", lineHeight: "20px" },
            ".cm-gutters": { background: "transparent", borderRight: "1px solid hsl(var(--border))" },
            ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px", color: "hsl(var(--muted-foreground))" },
            ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.35)" },
            ".cm-activeLineGutter": { backgroundColor: "hsl(var(--muted) / 0.35)" },
          }),
        ],
      }),
    });

    viewRef.current = view;

    // Dev-only handle so e2e flows can drive the editor selection.
    if (import.meta.env.DEV) {
      (window as unknown as { __artifactEditorView?: EditorView }).__artifactEditorView = view;
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      if (import.meta.env.DEV) {
        delete (window as unknown as { __artifactEditorView?: EditorView }).__artifactEditorView;
      }
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const current = view.state.doc.toString();

    if (current === props.value) {
      return;
    }

    view.dispatch({ changes: { from: 0, to: current.length, insert: props.value } });
  }, [props.value]);

  const editor = <div ref={rootRef} className={cn("h-full min-h-0 overflow-hidden", props.className)} />;

  return editor;
}
