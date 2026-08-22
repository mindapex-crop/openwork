declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual: (expected: unknown) => void;
};

import { platformCapabilities } from "./platform-capabilities";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalElectron = Object.getOwnPropertyDescriptor(globalThis, "__OPENWORK_ELECTRON__");

function setElectronRuntime(enabled: boolean) {
  // isElectronRuntime() checks `typeof window !== "undefined" &&
  // window.__OPENWORK_ELECTRON__ != null`. In bun's test env window may not
  // exist, so we ensure it does and set the flag on it.
  if (typeof window === "undefined") {
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true, writable: true });
  }
  if (enabled) {
    (window as unknown as Record<string, unknown>).__OPENWORK_ELECTRON__ = {};
  } else {
    delete (window as unknown as Record<string, unknown>).__OPENWORK_ELECTRON__;
  }
}

function restoreRuntime() {
  const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : undefined;
  if (win) {
    if (originalElectron?.value !== undefined) {
      win.__OPENWORK_ELECTRON__ = originalElectron.value;
    } else {
      delete win.__OPENWORK_ELECTRON__;
    }
  }
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else if (typeof window !== "undefined") {
    Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
  }
}

describe("platformCapabilities", () => {
  test("returns false for every capability outside Electron", () => {
    setElectronRuntime(false);
    expect(platformCapabilities()).toEqual({
      nativeFilePicker: false,
      revealInFileManager: false,
      terminal: false,
      autoUpdate: false,
      osNotifications: false,
      localRuntimeControl: false,
      desktopBootstrap: false,
    });
    restoreRuntime();
  });

  test("returns true for every capability in Electron", () => {
    setElectronRuntime(true);
    expect(platformCapabilities()).toEqual({
      nativeFilePicker: true,
      revealInFileManager: true,
      terminal: true,
      autoUpdate: true,
      osNotifications: true,
      localRuntimeControl: true,
      desktopBootstrap: true,
    });
    restoreRuntime();
  });
});
