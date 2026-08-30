/**
 * 工作模式（WorkBuddy 对标：日常办公 / 代码开发 / 设计创意）。
 *
 * 选择结果存 localStorage；日常办公模式默认隐藏开发者元素。
 */
export const WORK_MODE_KEY = "openwork.workMode";

export type WorkMode = "daily" | "code" | "design";

export const WORK_MODE_VALUES: readonly WorkMode[] = ["daily", "code", "design"];

export const isWorkMode = (value: unknown): value is WorkMode =>
  typeof value === "string" && (WORK_MODE_VALUES as readonly string[]).includes(value);

/** 默认工作模式：代码开发（未选择过时按开发者工具对待）。 */
export const DEFAULT_WORK_MODE: WorkMode = "code";

export function readWorkMode(): WorkMode {
  if (typeof window === "undefined") return DEFAULT_WORK_MODE;
  try {
    const stored = window.localStorage.getItem(WORK_MODE_KEY);
    return isWorkMode(stored) ? stored : DEFAULT_WORK_MODE;
  } catch {
    return DEFAULT_WORK_MODE;
  }
}

export function writeWorkMode(mode: WorkMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORK_MODE_KEY, mode);
  } catch {
    // ignore persistence failures
  }
}

/** 日常办公模式隐藏开发者元素（设置/状态开关）。 */
export function hideDeveloperElements(mode: WorkMode = readWorkMode()): boolean {
  return mode === "daily";
}
