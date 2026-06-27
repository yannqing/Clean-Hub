import { createId } from "@cleanhub/id";

import {
  ApiHttpError,
  ApiNetworkError,
  ApiParseError,
  ApiTimeoutError,
  type ApiErrorDetails,
} from "./errors";
import type {
  ApiClient,
  ApiClientConfig,
  ApiParseAs,
  ApiRequestBody,
  ApiRequestContext,
  ApiRequestOptions,
  HttpMethod,
  QueryParams,
  QueryValue,
} from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_RETRY_STATUSES = [408, 429, 500, 502, 503, 504] as const;
const IDEMPOTENT_METHODS = new Set<HttpMethod>(["GET", "PUT", "DELETE"]);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getRuntimeOrigin(): string {
  if (typeof globalThis.location?.origin === "string") {
    return globalThis.location.origin;
  }

  throw new Error(
    "Relative API URLs require a browser origin. Use an absolute baseUrl on the server.",
  );
}

function createRequestId(): string {
  return createId();
}

function appendQueryValue(searchParams: URLSearchParams, key: string, value: QueryValue): void {
  if (value === null || typeof value === "undefined") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      searchParams.append(key, String(item));
    }
    return;
  }

  searchParams.append(key, String(value));
}

export function buildApiUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const requestUrl = isAbsoluteUrl(path)
    ? path
    : `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(path)}`;
  const url = isAbsoluteUrl(requestUrl)
    ? new URL(requestUrl)
    : new URL(requestUrl, getRuntimeOrigin());

  if (!query) {
    return url.toString();
  }

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => url.searchParams.append(key, value));
    return url.toString();
  }

  if (Array.isArray(query)) {
    for (const [key, value] of query) {
      url.searchParams.append(key, value);
    }
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(url.searchParams, key, value);
  }

  return url.toString();
}

function isBodyInit(body: ApiRequestBody): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

function mergeHeaders(...headersList: (HeadersInit | undefined)[]): Headers {
  const headers = new Headers();

  for (const headersInit of headersList) {
    if (!headersInit) {
      continue;
    }

    new Headers(headersInit).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

async function resolveHeaders(
  defaultHeaders: ApiClientConfig["defaultHeaders"],
  tokenProvider: ApiClientConfig["tokenProvider"],
  requestHeaders?: HeadersInit,
): Promise<Headers> {
  const resolvedDefaultHeaders =
    typeof defaultHeaders === "function" ? await defaultHeaders() : defaultHeaders;
  const headers = mergeHeaders(resolvedDefaultHeaders, requestHeaders);
  const token = await tokenProvider?.();

  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

function prepareBody(body: ApiRequestBody, headers: Headers): BodyInit | undefined {
  if (body === null || typeof body === "undefined") {
    return undefined;
  }

  if (isBodyInit(body)) {
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

function getParseMode(response: Response, parseAs?: ApiParseAs): ApiParseAs {
  if (parseAs) {
    return parseAs;
  }

  if (response.status === 204 || response.status === 205) {
    return "void";
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? "json" : "text";
}

async function parseResponseBody<TResponse>(
  response: Response,
  parseAs?: ApiParseAs,
  requestId?: string,
): Promise<TResponse> {
  const mode = getParseMode(response, parseAs);

  try {
    if (mode === "response") {
      return response as TResponse;
    }

    if (mode === "void") {
      return undefined as TResponse;
    }

    if (mode === "text") {
      return (await response.text()) as TResponse;
    }

    if (mode === "blob") {
      return (await response.blob()) as TResponse;
    }

    if (mode === "arrayBuffer") {
      return (await response.arrayBuffer()) as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    throw new ApiParseError({
      message: "Failed to parse API response.",
      status: response.status,
      url: response.url,
      requestId,
      cause: error,
    });
  }
}

function getErrorMessage(response: Response, parsedBody: unknown): string {
  if (parsedBody && typeof parsedBody === "object" && "message" in parsedBody) {
    const message = (parsedBody as ApiErrorDetails).message;
    if (message) {
      return message;
    }
  }

  return `API request failed with ${response.status} ${response.statusText}.`;
}

function getErrorCode(parsedBody: unknown): string | undefined {
  if (parsedBody && typeof parsedBody === "object" && "code" in parsedBody) {
    const code = (parsedBody as ApiErrorDetails).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function getValidationErrors(parsedBody: unknown): ApiErrorDetails["validationErrors"] {
  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    "validationErrors" in parsedBody
  ) {
    return (parsedBody as ApiErrorDetails).validationErrors;
  }

  return undefined;
}

function shouldRetry({
  method,
  status,
  attempt,
  retries,
  retryOnStatuses,
}: {
  method: HttpMethod;
  status?: number;
  attempt: number;
  retries: number;
  retryOnStatuses: readonly number[];
}): boolean {
  if (attempt > retries) {
    return false;
  }

  if (!IDEMPOTENT_METHODS.has(method)) {
    return false;
  }

  return typeof status === "undefined" || retryOnStatuses.includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createAbortSignal({
  requestSignal,
  timeoutMs,
}: {
  requestSignal?: AbortSignal;
  timeoutMs: number;
}): {
  signal: AbortSignal;
  clear: () => void;
  isTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timeoutTriggered = false;

  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);

  if (requestSignal) {
    if (requestSignal.aborted) {
      controller.abort();
    } else {
      requestSignal.addEventListener(
        "abort",
        () => {
          controller.abort();
        },
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
    isTimeout: () => timeoutTriggered,
  };
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryConfig = config.retry ?? {};
  const retries = retryConfig.retries ?? 0;
  const retryDelayMs = retryConfig.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const retryOnStatuses =
    retryConfig.retryOnStatuses ?? DEFAULT_RETRY_STATUSES;

  async function request<TResponse = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    const method = options.method ?? "GET";
    const requestId = options.requestId ?? createRequestId();
    const url = buildApiUrl(config.baseUrl, path, options.query);

    async function runAttempt(attempt: number): Promise<TResponse> {
      const context: ApiRequestContext = {
        url,
        path,
        method,
        requestId,
        attempt,
        metadata: options.metadata,
      };
      const headers = await resolveHeaders(
        config.defaultHeaders,
        config.tokenProvider,
        options.headers,
      );

      if (options.idempotencyKey) {
        headers.set("idempotency-key", options.idempotencyKey);
      }

      if (!headers.has("accept")) {
        headers.set("accept", "application/json");
      }

      const abort = createAbortSignal({
        requestSignal: options.signal,
        timeoutMs: options.timeoutMs ?? timeoutMs,
      });

      const baseInit: RequestInit = {
        method,
        headers,
        body: prepareBody(options.body, headers),
        credentials: options.credentials ?? config.credentials ?? "include",
        cache: options.cache,
        signal: abort.signal,
      };

      const nextInit =
        typeof options.next === "undefined"
          ? baseInit
          : ({ ...baseInit, next: options.next } as RequestInit);
      const requestInit = (await config.beforeRequest?.(nextInit, context)) ?? nextInit;

      try {
        const response = await fetchImpl(url, requestInit);
        abort.clear();

        await config.afterResponse?.(response, {
          ...context,
          status: response.status,
          ok: response.ok,
          response,
        });

        if (response.ok) {
          return parseResponseBody<TResponse>(
            response,
            options.parseAs,
            requestId,
          );
        }

        const parsedError = await parseResponseBody<unknown>(
          response,
          undefined,
          requestId,
        ).catch(() => undefined);

        const httpError = new ApiHttpError({
          message: getErrorMessage(response, parsedError),
          status: response.status,
          statusText: response.statusText,
          method,
          url,
          requestId,
          code: getErrorCode(parsedError),
          responseData: parsedError,
          validationErrors: getValidationErrors(parsedError),
        });

        if (
          response.status === 401 &&
          !options.skipAuthRefresh &&
          config.onUnauthorized
        ) {
          const unauthorizedResult = await config.onUnauthorized(httpError, context);
          if (unauthorizedResult === "retry") {
            return request<TResponse>(path, {
              ...options,
              requestId,
              skipAuthRefresh: true,
            });
          }
        }

        if (
          shouldRetry({
            method,
            status: response.status,
            attempt,
            retries,
            retryOnStatuses,
          })
        ) {
          await sleep(retryDelayMs * attempt);
          return runAttempt(attempt + 1);
        }

        await config.onError?.(httpError, context);
        throw httpError;
      } catch (error) {
        abort.clear();

        if (error instanceof ApiHttpError || error instanceof ApiParseError) {
          throw error;
        }

        const clientError = abort.isTimeout()
          ? new ApiTimeoutError(options.timeoutMs ?? timeoutMs, {
              requestId,
              cause: error,
            })
          : new ApiNetworkError("API request failed due to a network error.", {
              requestId,
              cause: error,
            });

        if (
          shouldRetry({
            method,
            attempt,
            retries,
            retryOnStatuses,
          })
        ) {
          await sleep(retryDelayMs * attempt);
          return runAttempt(attempt + 1);
        }

        await config.onError?.(clientError, context);
        throw clientError;
      }
    }

    return runAttempt(1);
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: "GET" }),
    post: (path, body, options) =>
      request(path, { ...options, method: "POST", body }),
    put: (path, body, options) =>
      request(path, { ...options, method: "PUT", body }),
    patch: (path, body, options) =>
      request(path, { ...options, method: "PATCH", body }),
    delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  };
}
