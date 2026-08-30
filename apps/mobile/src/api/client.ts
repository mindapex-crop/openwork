import type { AppConfig } from "../config";

/**
 * API 请求错误。
 * - status 0：网络不可达 / 超时（离线容错场景，UI 提示重试）
 * - status 4xx/5xx：服务端返回的业务错误，code/message 取自响应体
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export interface RequestOptions {
  /** query 参数（会做 URL 编码） */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON body（自动序列化并设置 Content-Type） */
  body?: unknown;
  /** 覆盖全局超时（毫秒） */
  timeoutMs?: number;
}

interface ErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

/** 解析服务端错误体：{ error | code, message } 两种风格都兼容 */
function parseErrorBody(payload: unknown): ErrorBody {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    return {
      error: typeof record.error === "string" ? record.error : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }
  return {};
}

function buildQueryString(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

/** fetch 封装：base URL 拼接、超时、错误归一化、JSON 解析 */
export class ApiClient {
  constructor(private readonly config: AppConfig) {}

  getConfig(): AppConfig {
    return this.config;
  }

  /** 变更配置（设置页保存后调用） */
  updateConfig(patch: Partial<AppConfig>): void {
    Object.assign(this.config, patch);
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.config.serverUrl.replace(/\/+$/, "")}${path}${buildQueryString(options.query)}`;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.config.bearerToken) {
      headers.Authorization = `Bearer ${this.config.bearerToken}`;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(0, "timeout", `Request timed out after ${timeoutMs}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ApiError(0, "network_error", `Network request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    }

    if (!response.ok) {
      const { error, code, message } = parseErrorBody(payload);
      throw new ApiError(
        response.status,
        error ?? code ?? "request_failed",
        message ?? `Request failed with status ${response.status}`,
        payload,
      );
    }

    return payload as T;
  }

  get<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("POST", path, { ...options, body });
  }
}
