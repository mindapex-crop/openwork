import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createServerLogger } from "../src/server.js";
import type { LogFormat, ServerConfig } from "../src/types.js";

// `process.stdout.write` is expected to throw synchronously on pipe errors
// (EPIPE / ECONNRESET / EIO). Duplex streams emit an 'error' event instead,
// which `try/catch` does not catch — so we stub stdout as a plain object that
// throws synchronously, matching the real-world TTY pipe-break failure mode.
function makeFailingStdout(code: string) {
  const fake = {
    destroyed: false,
    closed: false,
    writableEnded: false,
    write(_chunk: string) {
      const err = new Error(`stream error: ${code}`);
      (err as NodeJS.ErrnoException).code = code;
      throw err;
    },
  };
  return fake as unknown as typeof process.stdout;
}

function makeConfig(logFormat: LogFormat): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 8787,
    token: "test-client-token",
    hostToken: "test-host-token",
    approval: { mode: "auto", timeoutMs: 30000 },
    corsOrigins: ["*"],
    workspaces: [],
    authorizedRoots: [],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "generated",
    hostTokenSource: "generated",
    logFormat,
    logRequests: false,
  };
}

let originalStdout: typeof process.stdout;

beforeEach(() => {
  originalStdout = process.stdout;
});

afterEach(() => {
  process.stdout = originalStdout;
});

describe("createServerLogger — EPIPE / pipe-error resilience", () => {
  const safeCodes = [
    "EPIPE",
    "ECONNRESET",
    "EIO",
    "ERR_STREAM_DESTROYED",
    "ERR_STREAM_WRITE_AFTER_END",
  ] as const;

  test.each([...safeCodes])("stdout throws %s — logger does not rethrow (pretty format)", (code: string) => {
    process.stdout = makeFailingStdout(code);
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "hello world")).not.toThrow();
  });

  test.each([...safeCodes])("stdout throws %s — logger does not rethrow (json format)", (code: string) => {
    process.stdout = makeFailingStdout(code);
    const logger = createServerLogger(makeConfig("json"));
    expect(() => logger.log("warn", "json record", { "test.key": "val" })).not.toThrow();
  });

  test.each(["error", "warn", "info"] as const)("%s log level survives EPIPE", (level) => {
    process.stdout = makeFailingStdout("EPIPE");
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log(level, `${level} message`)).not.toThrow();
  });

  test("non-pipe errors are still rethrown", () => {
    process.stdout = makeFailingStdout("ENOENT");
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "boom")).toThrow("ENOENT");
  });

  test("EADDRINUSE is rethrown (not in the safe list)", () => {
    process.stdout = makeFailingStdout("EADDRINUSE");
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "boom")).toThrow("EADDRINUSE");
  });

  test("null stdout — logger does not throw", () => {
    process.stdout = undefined as unknown as typeof process.stdout;
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "no stdout")).not.toThrow();
  });

  test("destroyed stdout flag — logger does not throw", () => {
    process.stdout = {
      destroyed: true,
      closed: false,
      writableEnded: false,
      write(_chunk: string) {
        throw new Error("should not be called");
      },
    } as unknown as typeof process.stdout;
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "destroyed")).not.toThrow();
  });

  test("closed stdout flag — logger does not throw", () => {
    process.stdout = {
      destroyed: false,
      closed: true,
      writableEnded: false,
      write(_chunk: string) {
        throw new Error("should not be called");
      },
    } as unknown as typeof process.stdout;
    const logger = createServerLogger(makeConfig("pretty"));
    expect(() => logger.log("info", "closed")).not.toThrow();
  });

  test("rapid burst of EPIPE — no rethrown errors across 1000 writes", () => {
    process.stdout = makeFailingStdout("EPIPE");
    const logger = createServerLogger(makeConfig("pretty"));
    let i = 0;
    for (; i < 1000; i++) {
      logger.log("info", `burst ${i}`);
    }
    expect(i).toBe(1000);
  });

  test("json log format — record includes expected fields despite EPIPE", () => {
    // When stdout works, JSON records carry structured fields.
    let captured: string | null = null;
    process.stdout = {
      destroyed: false,
      closed: false,
      writableEnded: false,
      write(chunk: string) {
        captured = chunk;
        return true;
      },
    } as unknown as typeof process.stdout;
    const logger = createServerLogger(makeConfig("json"));
    logger.log("info", "structured test", { "test.key": "test-value" });
    expect(captured).not.toBeNull();
    expect(captured!).toContain('"severityText":"INFO"');
    expect(captured!).toContain('"body":"structured test"');
    expect(captured!).toContain('"test.key":"test-value"');
  });
});
