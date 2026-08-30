import { describe, expect, test } from "bun:test";

import { useTextToSpeech } from "@/react-app/domains/session/voice/use-text-to-speech";

describe("useTextToSpeech hook", () => {
  test("导出可调用 hook", () => {
    expect(typeof useTextToSpeech).toBe("function");
  });
});
