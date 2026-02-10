import { getLogger } from "../logger.js";

interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  headerName?: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  retries?: number;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly headerName: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.headerName = options.headerName ?? "X-Api-Key";
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      body,
      params,
      timeout = 15_000,
      retries = 2,
    } = options;

    let urlStr = `${this.baseUrl}${path}`;
    if (params) {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      }
      if (parts.length > 0) {
        urlStr += `?${parts.join("&")}`;
      }
    }
    const url = new URL(urlStr);

    const headers: Record<string, string> = {
      [this.headerName]: this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const logger = getLogger();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          const error = new Error(
            `API ${method} ${path} returned ${response.status}: ${text}`,
          );
          if (response.status >= 500) {
            lastError = error;
            logger.warn(
              { attempt, status: response.status, path },
              "Retryable API error",
            );
            continue;
          }
          throw error;
        }

        if (response.status === 204) return undefined as T;

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          lastError = new Error(`API ${method} ${path} timed out`);
          logger.warn({ attempt, path }, "API request timed out");
          continue;
        }
        if (error instanceof AggregateError) {
          const messages = error.errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join("; ");
          lastError = new Error(`API ${method} ${path} connection failed: ${messages}`);
          logger.warn({ attempt, path, errors: messages }, "API connection failed (AggregateError)");
          continue;
        }
        if (
          error instanceof TypeError &&
          error.message.includes("fetch failed")
        ) {
          lastError = error;
          logger.warn({ attempt, path }, "API connection failed");
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new Error(`API ${method} ${path} failed after retries`);
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>(path, { params });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "PUT", body });
  }

  async delete<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>(path, { method: "DELETE", params });
  }
}
