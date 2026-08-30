/**
 * 录屏产物的落地辅助：命名、封装成附件文件、能力探测。
 *
 * 纯模块，供 `screen-recorder.tsx`（下载文件名）与会话 surface（把录制结果
 * 作为附件送进 composer）共用，避免两处各自拼时间戳文件名。
 */

export const RECORDING_MIME = "video/webm";

/** ISO 文件名安全的录制文件名，例如 `recording-2026-08-29T07-30-00-000Z.webm`。 */
export function recordingFileName(now: Date = new Date()): string {
  return `recording-${now.toISOString().replace(/[:.]/g, "-")}.webm`;
}

/** 把录制 Blob 包成 File，以走 composer 既有的附件通道。 */
export function recordingFile(blob: Blob, name: string = recordingFileName()): File {
  return new File([blob], name, { type: blob.type || RECORDING_MIME });
}

/** 当前运行时是否支持屏幕捕获；不支持时入口应当隐藏而非点了报错。 */
export function isScreenRecordingSupported(
  runtime?: { mediaDevices?: { getDisplayMedia?: unknown } } | null,
): boolean {
  return typeof runtime?.mediaDevices?.getDisplayMedia === "function";
}
