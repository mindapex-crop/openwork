import { describe, expect, test } from "bun:test";

import {
  isScreenRecordingSupported,
  RECORDING_MIME,
  recordingFile,
  recordingFileName,
} from "../src/react-app/domains/capture/recording-file";

describe("recordingFileName（录制文件名）", () => {
  test("用 ISO 时间戳且不含冒号或额外圆点", () => {
    expect(recordingFileName(new Date("2026-08-29T07:30:00.000Z"))).toBe(
      "recording-2026-08-29T07-30-00-000Z.webm",
    );
  });

  test("默认取当前时间且始终带 .webm 后缀", () => {
    const name = recordingFileName();
    expect(name.startsWith("recording-")).toBe(true);
    expect(name.endsWith(".webm")).toBe(true);
  });
});

describe("recordingFile（Blob 封装成附件文件）", () => {
  test("保留 blob 的类型与内容", async () => {
    const blob = new Blob(["payload"], { type: "video/webm" });
    const file = recordingFile(blob, "take.webm");
    expect(file.name).toBe("take.webm");
    expect(file.type).toBe("video/webm");
    expect(file.size).toBe(blob.size);
    expect(await file.text()).toBe("payload");
  });

  test("blob 缺类型时回落到 webm", () => {
    expect(recordingFile(new Blob(["x"]), "take.webm").type).toBe(RECORDING_MIME);
  });

  test("省略文件名时自动命名", () => {
    expect(recordingFile(new Blob(["x"], { type: RECORDING_MIME })).name).toBe(recordingFileName());
  });
});

describe("isScreenRecordingSupported（能力探测）", () => {
  test("缺少 mediaDevices 或 getDisplayMedia 时判定为不支持", () => {
    expect(isScreenRecordingSupported(undefined)).toBe(false);
    expect(isScreenRecordingSupported(null)).toBe(false);
    expect(isScreenRecordingSupported({})).toBe(false);
    expect(isScreenRecordingSupported({ mediaDevices: {} })).toBe(false);
    expect(isScreenRecordingSupported({ mediaDevices: { getDisplayMedia: "nope" } })).toBe(false);
  });

  test("存在 getDisplayMedia 时判定为支持", () => {
    expect(isScreenRecordingSupported({ mediaDevices: { getDisplayMedia: () => {} } })).toBe(true);
  });

  test("真实 navigator 全局可直传", () => {
    expect(typeof isScreenRecordingSupported(navigator)).toBe("boolean");
  });
});
