/** @jsxImportSource react */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import {
  BoldIcon,
  ItalicIcon,
  Underline as UnderlineIconSvg,
  StrikethroughIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
  LinkIcon,
  UndoIcon,
  RedoIcon,
} from "lucide-react";
import { marked } from "marked";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  className?: string;
};

/**
 * Convert HTML to Markdown using a simple heuristic approach.
 * TipTap's getMarkdown() requires additional extensions, so we use
 * marked.parse in reverse for basic conversion.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  
  let markdown = html;
  
  // Replace headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  
  // Replace bold/strong
  markdown = markdown.replace(/<(?:b|strong)[^>]*>(.*?)<\/(?:b|strong)>/gi, "**$1**");
  
  // Replace italic/em
  markdown = markdown.replace(/<(?:i|em)[^>]*>(.*?)<\/(?:i|em)>/gi, "*$1*");
  
  // Replace strikethrough
  markdown = markdown.replace(/<(?:s|strike|del)[^>]*>(.*?)<\/(?:s|strike|del)>/gi, "~~$1~~");
  
  // Replace code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n");
  
  // Replace inline code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  
  // Replace blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n\n");
  
  // Replace ordered lists (must be before unordered list li replacement)
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content: string) => {
    let index = 0;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (_tag: string, itemContent: string) => {
      index++;
      return `${index}. ${itemContent}\n`;
    }) + "\n";
  });
  
  // Replace unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1\n");
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  
  // Replace links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  
  return markdown.trim();
}

/**
 * Convert Markdown to HTML using marked
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  return marked.parse(markdown, { breaks: true }) as string;
}

export function RichTextEditor({ value, onChange, readOnly = false, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }: { editor: any }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    active,
    icon: Icon,
    label,
    disabled = false,
  }: {
    onClick: () => void;
    active?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    disabled?: boolean;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 w-7 rounded-md",
        active && "bg-muted text-foreground"
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  const setLink = () => {
    const url = window.prompt(t("editor.link_url_prompt") || "Enter URL:");
    if (url) {
      // For now, just insert as text since we don't have Link extension
      editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    }
  };

  // Note: underline is not available in starter-kit by default
  // We're showing the button but it won't work without the extension
  const hasUnderline = false;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            icon={BoldIcon}
            label={t("editor.bold")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            icon={ItalicIcon}
            label={t("editor.italic")}
          />
          {hasUnderline && (
            <ToolbarButton
              onClick={() => {}}
              active={false}
              icon={UnderlineIconSvg}
              label={t("editor.underline")}
              disabled
            />
          )}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            icon={StrikethroughIcon}
            label={t("editor.strikethrough")}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            icon={Heading1Icon}
            label={t("editor.heading_1")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            icon={Heading2Icon}
            label={t("editor.heading_2")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            icon={Heading3Icon}
            label={t("editor.heading_3")}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            icon={ListIcon}
            label={t("editor.bullet_list")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            icon={ListOrderedIcon}
            label={t("editor.numbered_list")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            icon={QuoteIcon}
            label={t("editor.quote")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            icon={CodeIcon}
            label={t("editor.code_block")}
          />
          <ToolbarButton
            onClick={setLink}
            active={false}
            icon={LinkIcon}
            label={t("editor.link")}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            icon={UndoIcon}
            label={t("editor.undo")}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            icon={RedoIcon}
            label={t("editor.redo")}
          />
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 focus:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-0 [&_.ProseMirror]:focus:outline-none"
        />
      </div>
    </div>
  );
}
