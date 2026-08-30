import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** 重新加载（手动重试） */
  reload: () => Promise<void>;
}

/**
 * 通用异步数据加载 hook：
 * - 自动加载 + 手动 reload（离线容错：失败后 UI 展示重试）
 * - 竞态防护：只有最后一次请求的结果会写入状态
 * - deps 变化时自动重新加载
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSeq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (seq === requestSeq.current) {
        setData(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void run();
    return () => {
      requestSeq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run };
}
