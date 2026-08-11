/**
 * 移植自 QM (MIT License, Copyright (c) 2026 QM contributors)
 * 原文件：qm/src/util/errors.ts
 * 移植说明：errMessage/swallow/swallowAs 三个辅助函数零改动；import 路径按 OpenWork NodeNext 约定使用 .js 扩展名（本文件无 import）。
 */

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function swallow(context: string, e: unknown): void {
  console.warn(`[swallowed] ${context}: ${errMessage(e)}`);
}

export function swallowAs<T>(context: string, fallback: T): (e: unknown) => T {
  return (e) => {
    swallow(context, e);
    return fallback;
  };
}
