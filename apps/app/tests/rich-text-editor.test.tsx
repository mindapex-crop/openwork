import { describe, expect, test } from "bun:test";
import { htmlToMarkdown, markdownToHtml } from "../src/react-app/domains/editor/rich-text-editor";

describe("RichTextEditor utilities", () => {
  describe("htmlToMarkdown", () => {
    test("converts headings correctly", () => {
      const html = "<h1>Title 1</h1><h2>Title 2</h2><h3>Title 3</h3>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("# Title 1");
      expect(md).toContain("## Title 2");
      expect(md).toContain("### Title 3");
    });

    test("converts bold and italic correctly", () => {
      const html = "<p><strong>Bold text</strong> and <em>italic text</em></p>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("**Bold text**");
      expect(md).toContain("*italic text*");
    });

    test("converts strikethrough correctly", () => {
      const html = "<p><s>Deleted text</s></p>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("~~Deleted text~~");
    });

    test("converts code blocks correctly", () => {
      const html = '<pre><code>const x = 1;\nconsole.log(x);</code></pre>';
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("```");
      expect(md).toContain("const x = 1;");
    });

    test("converts inline code correctly", () => {
      const html = "<p>Use <code>console.log()</code> for debugging</p>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("`console.log()`");
    });

    test("converts blockquotes correctly", () => {
      const html = "<blockquote>This is a quote</blockquote>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("> This is a quote");
    });

    test("converts unordered lists correctly", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("- Item 1");
      expect(md).toContain("- Item 2");
    });

    test("converts ordered lists correctly", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("1. First");
      expect(md).toContain("2. Second");
    });

    test("converts links correctly", () => {
      const html = '<a href="https://example.com">Example</a>';
      const md = htmlToMarkdown(html);
      
      expect(md).toContain("[Example](https://example.com)");
    });

    test("handles empty input", () => {
      expect(htmlToMarkdown("")).toBe("");
      expect(htmlToMarkdown(null as any)).toBe("");
    });

    test("removes remaining HTML tags", () => {
      const html = "<p>Some <span>text</span> here</p>";
      const md = htmlToMarkdown(html);
      
      expect(md).toBe("Some text here");
    });
  });

  describe("markdownToHtml", () => {
    test("converts headings correctly", async () => {
      const md = "# Title 1\n## Title 2\n### Title 3";
      const html = markdownToHtml(md);
      
      expect(html).toContain("<h1");
      expect(html).toContain("Title 1");
      expect(html).toContain("<h2");
      expect(html).toContain("Title 2");
      expect(html).toContain("<h3");
      expect(html).toContain("Title 3");
    });

    test("converts bold and italic correctly", async () => {
      const md = "**Bold text** and *italic text*";
      const html = markdownToHtml(md);
      
      expect(html).toContain("<strong");
      expect(html).toContain("Bold text");
      expect(html).toContain("<em");
      expect(html).toContain("italic text");
    });

    test("converts code blocks correctly", async () => {
      const md = "```\nconst x = 1;\n```";
      const html = markdownToHtml(md);
      
      expect(html).toContain("<pre");
      expect(html).toContain("<code");
      expect(html).toContain("const x = 1;");
    });

    test("converts links correctly", async () => {
      const md = "[Example](https://example.com)";
      const html = markdownToHtml(md);
      
      expect(html).toContain('<a href="https://example.com"');
      expect(html).toContain("Example");
    });

    test("handles empty input", () => {
      expect(markdownToHtml("")).toBe("");
      expect(markdownToHtml(null as any)).toBe("");
    });

    test("converts blockquotes correctly", async () => {
      const md = "> This is a quote";
      const html = markdownToHtml(md);
      
      expect(html).toContain("<blockquote");
      expect(html).toContain("This is a quote");
    });

    test("converts lists correctly", async () => {
      const md = "- Item 1\n- Item 2";
      const html = markdownToHtml(md);
      
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain("Item 1");
    });
  });

  describe("round-trip conversion", () => {
    test("markdown to HTML and back preserves content", async () => {
      const originalMd = "# Title\n\nSome **bold** and *italic* text.\n\n- Item 1\n- Item 2";
      const html = markdownToHtml(originalMd);
      const convertedMd = htmlToMarkdown(html);
      
      // Content should be preserved even if formatting differs slightly
      expect(convertedMd).toContain("Title");
      expect(convertedMd).toContain("bold");
      expect(convertedMd).toContain("italic");
      expect(convertedMd).toContain("Item 1");
    });
  });
});
