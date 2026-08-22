declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual: (expected: unknown) => void;
};

import {
  OPENWORK_EXTENSION_CATALOG,
  filterOpenWorkExtensionCatalogForPlatform,
  resolveOpenWorkExtensionCatalogPlatform,
} from "./constants";

function filteredIds(platform: "darwin" | "linux" | "windows" | "web") {
  return filterOpenWorkExtensionCatalogForPlatform(OPENWORK_EXTENSION_CATALOG, platform)
    .flatMap((entry) => entry.id ? [entry.id] : []);
}

describe("OpenWork extension catalog platform filter", () => {
  test("resolves browser runtime to web and desktop runtime to OS", () => {
    expect(resolveOpenWorkExtensionCatalogPlatform("web", "macos")).toEqual("web");
    expect(resolveOpenWorkExtensionCatalogPlatform("desktop", "macos")).toEqual("darwin");
    expect(resolveOpenWorkExtensionCatalogPlatform("desktop", "windows")).toEqual("windows");
    expect(resolveOpenWorkExtensionCatalogPlatform("desktop", "linux")).toEqual("linux");
  });

  test("hides desktop-only extensions in web", () => {
    const ids = filteredIds("web");
    // openwork-team-autonomy is preview + no platform gate so it appears everywhere
    expect(ids).toContain("openwork-voice");
    expect(ids).toContain("ollama");
    expect(ids).not.toContain("openwork-browser");
    expect(ids).not.toContain("computer-use");
  });

  test("keeps OpenWork Browser desktop-only and Computer Use mac-only", () => {
    const darwinIds = filteredIds("darwin");
    expect(darwinIds).toContain("openwork-browser");
    expect(darwinIds).toContain("computer-use");
    expect(darwinIds).toContain("openwork-voice");
    expect(darwinIds).toContain("ollama");

    const linuxIds = filteredIds("linux");
    expect(linuxIds).toContain("openwork-browser");
    expect(linuxIds).toContain("openwork-voice");
    expect(linuxIds).toContain("ollama");
    expect(linuxIds).not.toContain("computer-use");
  });
});
