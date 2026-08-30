/** @jsxImportSource react */
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenRecorder } from "../src/react-app/domains/capture/screen-recorder";

/**
 * `isScreenRecordingSupported(navigator)` is read during render, so swapping
 * `navigator.mediaDevices` between renders drives both branches.
 */
function setMediaDevices(value: { getDisplayMedia: () => void } | null) {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value,
    configurable: true,
  });
}

function textOf(markup: string) {
  return markup.replace(/<[^>]*>/g, "|").replace(/\|+/g, "|");
}

function cardHeader(markup: string) {
  return markup.match(/<div data-slot="card-header"[\s\S]*?(?=<div data-slot="card-content")/)?.[0] ?? "";
}

afterEach(() => setMediaDevices(null));

describe("ScreenRecorder", () => {
  test("hides the recorder and explains itself when screen capture is unavailable", () => {
    setMediaDevices(null);
    const markup = renderToStaticMarkup(<ScreenRecorder />);

    expect(textOf(markup)).toContain("does not support screen recording");
    expect(markup).not.toContain("Start Recording");
    expect(markup).not.toContain("<video");
  });

  test("shows the pre-recording state: audio opt-in and a start control, no preview yet", () => {
    setMediaDevices({ getDisplayMedia: () => {} });
    const markup = renderToStaticMarkup(<ScreenRecorder />);
    const text = textOf(markup);

    expect(text).toContain("Select Screen to Record");
    expect(text).toContain("Include Microphone Audio");
    expect(text).toContain("Start Recording");
    expect(markup).toContain('aria-label="Include Microphone Audio"');
    expect(markup).not.toContain("<video");
  });

  test("only renders a way out when the host can be cancelled", () => {
    setMediaDevices({ getDisplayMedia: () => {} });

    const closable = cardHeader(renderToStaticMarkup(<ScreenRecorder onCancel={() => {}} />));
    const standalone = cardHeader(renderToStaticMarkup(<ScreenRecorder />));

    expect(closable).toContain("<button");
    expect(standalone).not.toContain("<button");
  });
});
