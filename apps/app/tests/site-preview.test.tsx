/** @jsxImportSource react */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SitePreview } from "../src/react-app/domains/browser/site-preview";

function render(props: Parameters<typeof SitePreview>[0]) {
  return renderToStaticMarkup(<SitePreview {...props} />);
}

function markupText(markup: string) {
  return markup.replace(/<[^>]*>/g, "|").replace(/\|+/g, "|");
}

describe("SitePreview", () => {
  test("embeds the previewed url in a sandboxed iframe", () => {
    const markup = render({ url: "https://example.com" });
    const iframe = markup.match(/<iframe[^>]*>/)?.[0] ?? "";

    expect(iframe).toContain('src="https://example.com"');
    expect(iframe).toContain('title="Site Preview"');
    expect(iframe).toContain('sandbox="allow-same-origin allow-scripts allow-forms allow-popups"');
    expect(iframe).toContain('allow="fullscreen; autoplay"');
  });

  test("passes a blob url through untouched for locally generated previews", () => {
    const blobUrl = "blob:http://localhost/5c1e0b";
    expect(render({ url: blobUrl })).toContain(`src="${blobUrl}"`);
  });

  test("offers the three viewports plus reload, copy and fullscreen as labelled controls", () => {
    const markup = render({ url: "https://example.com" });
    const labels = [...markup.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);

    expect(labels).toEqual([
      "Desktop viewport",
      "Tablet viewport",
      "Mobile viewport",
      "Reload preview",
      "Copy preview URL",
      "Enter fullscreen",
    ]);
  });

  test("sizes the frame per viewport and names the active one", () => {
    const cases = [
      { viewport: undefined, width: "100%", label: "Desktop" },
      { viewport: "tablet" as const, width: "768px", label: "Tablet (768px)" },
      { viewport: "mobile" as const, width: "375px", label: "Mobile (375px)" },
    ] as const;

    for (const entry of cases) {
      const markup = render({ url: "https://example.com", viewport: entry.viewport });
      expect(markup).toContain(`width:${entry.width}`);
      expect(markupText(markup)).toContain(`|${entry.label}|`);
    }
  });
});
