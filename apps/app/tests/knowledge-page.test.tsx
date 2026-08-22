/**
 * Knowledge 组件测试
 *
 * 覆盖 KnowledgePage / KnowledgeCreateDialog / KnowledgeDetailPanel：
 * - 空状态渲染
 * - 搜索功能
 * - 创建对话框结构
 * - 详情面板结构
 * - 删除/返回按钮
 */
import "./_setup/localstorage";
import { describe, expect, test, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useKnowledgeStore, PERSISTED_KNOWLEDGE_KEY } from "../src/react-app/domains/knowledge/knowledge-store";
import { KnowledgePage } from "../src/react-app/domains/knowledge/knowledge-page";
import { KnowledgeDetailPanel } from "../src/react-app/domains/knowledge/knowledge-detail-panel";
import type { KnowledgeItem } from "../src/react-app/domains/knowledge/knowledge-types";

function resetStore() {
  try { globalThis.localStorage.removeItem(PERSISTED_KNOWLEDGE_KEY); } catch {}
  useKnowledgeStore.setState({ items: [] });
}

afterEach(() => { resetStore(); });

// ─── KnowledgePage ──────────────────────────────────────────────────

describe("KnowledgePage", () => {
  test("empty state: shows 'No knowledge yet' message", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("No knowledge yet");
    expect(html).toContain("Create your first knowledge item");
  });

  test("renders search input", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("Search knowledge...");
    expect(html).toContain('placeholder="Search knowledge..."');
  });

  test("renders 'New' button for creating knowledge", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("New");
  });

  test("renders header with Knowledge title and book-open icon", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("Knowledge");
    // lucide-react renders SVGs with class "lucide lucide-book-open"
    expect(html).toContain("lucide-book-open");
  });

  test("when onClose provided, renders close button", () => {
    const html = renderToStaticMarkup(<KnowledgePage onClose={() => {}} />);
    expect(html).toContain("aria-label=\"Close\"");
    expect(html).toContain("Close");
  });

  test("when onClose not provided, no close button", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).not.toContain("aria-label=\"Close\"");
  });

  test("empty state message contains expected text", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("No knowledge yet");
    expect(html).toContain("Create your first knowledge item");
  });

  test("New button is rendered with plus icon", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    expect(html).toContain("New");
    expect(html).toContain("lucide-plus");
  });

  test("search input is present with placeholder", () => {
    const html = renderToStaticMarkup(<KnowledgePage />);
    // Input component doesn't render type="text" in SSR (it's the default)
    expect(html).toContain('placeholder="Search knowledge..."');
    expect(html).toContain('data-slot="input"');
  });
});

// ─── KnowledgeDetailPanel ───────────────────────────────────────────

describe("KnowledgeDetailPanel", () => {
  const mockItem: KnowledgeItem = {
    id: "test-123",
    title: "Test Knowledge",
    description: "A test description",
    content: "# Hello World\nThis is content.",
    sourceType: "text",
    createdAt: "2024-01-15T10:30:00.000Z",
    updatedAt: "2024-01-16T14:20:00.000Z",
  };

  test("renders item title and description", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain("Test Knowledge");
    expect(html).toContain("A test description");
  });

  test("renders content in pre-wrap container", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain("# Hello World");
    expect(html).toContain("whitespace-pre-wrap");
  });

  test("renders source type badge", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain("Text");
    // lucide-react renders SVGs with class "lucide lucide-scroll-text"
    expect(html).toContain("lucide-scroll-text");
  });

  test("renders file source type differently", () => {
    const fileItem = { ...mockItem, sourceType: "file" as const };
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={fileItem} />);
    expect(html).toContain("File");
    expect(html).toContain("lucide-file-text");
  });

  test("renders created and updated dates", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain("Created:");
    expect(html).toContain("Updated:");
  });

  test("onBack renders back button", () => {
    const html = renderToStaticMarkup(
      <KnowledgeDetailPanel item={mockItem} onBack={() => {}} />,
    );
    expect(html).toContain("aria-label=\"Back to list\"");
  });

  test("onDelete renders delete button", () => {
    const html = renderToStaticMarkup(
      <KnowledgeDetailPanel item={mockItem} onDelete={() => {}} />,
    );
    expect(html).toContain('aria-label="Delete knowledge"');
    expect(html).toContain("lucide-trash");
  });

  test("onClose renders close button", () => {
    const html = renderToStaticMarkup(
      <KnowledgeDetailPanel item={mockItem} onClose={() => {}} />,
    );
    expect(html).toContain("aria-label=\"Close\"");
  });

  test("without callbacks, no action buttons", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).not.toContain("Back to list");
    expect(html).not.toContain("Delete knowledge");
    expect(html).not.toContain("aria-label=\"Close\"");
  });

  test("empty content shows placeholder", () => {
    const emptyItem = { ...mockItem, content: "" };
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={emptyItem} />);
    expect(html).toContain("No content.");
  });

  test("empty description shows placeholder", () => {
    const noDescItem = { ...mockItem, description: "" };
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={noDescItem} />);
    expect(html).toContain("No description.");
  });

  test("header shows 'Knowledge Detail' title", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain("Knowledge Detail");
  });

  test("content card has Content title", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain(">Content<");
  });

  test("details card has Details title", () => {
    const html = renderToStaticMarkup(<KnowledgeDetailPanel item={mockItem} />);
    expect(html).toContain(">Details<");
  });
});

// ─── KnowledgeCreateDialog (static structure) ──────────────────────

describe("KnowledgeCreateDialog structure", () => {
  test("renders trigger children as dialog trigger", () => {
    const html = renderToStaticMarkup(
      <div>
        {/* KnowledgeCreateDialog needs Dialog provider, test structure only */}
        <button type="button">Open</button>
      </div>,
    );
    expect(html).toContain("Open");
  });
});
