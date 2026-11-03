export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];

export type QueryParams =
  | URLSearchParams
  | Record<string, QueryValue>
  | readonly [string, string][];

export type ApiParseAs =
  | "json"
  | "text"
  | "blob"
  | "arrayBuffer"
  | "void"
  | "response";

export type ApiRequestBody =
  | BodyInit
  | Record<string, unknown>
  | readonly unknown[]
  | null
  | undefined;

export type ApiRequestOptions = {
  method?: HttpMethod;
  query?: QueryParams;
  headers?: HeadersInit;
  body?: ApiRequestBody;
  signal?: AbortSignal;
  timeoutMs?: number;
  parseAs?: ApiParseAs;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  next?: unknown;
  idempotencyKey?: string;
  requestId?: string;
  skipAuthRefresh?: boolean;
  metadata?: Record<string, unknown>;
  afterResponse?: (
    response: Response,
    context: ApiResponseContext,
  ) => Promise<void> | void;
};

export type ApiRequestContext = {
  url: string;
  path: string;
  method: HttpMethod;
  requestId: string;
  attempt: number;
  metadata?: Record<string, unknown>;
};

export type ApiResponseContext = ApiRequestContext & {
  status: number;
  ok: boolean;
  response: Response;
};

export type ApiRetryConfig = {
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: readonly number[];
};

export type ApiUnauthorizedResult = "retry" | "logout" | "ignore" | void;
export type ApiTokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export type ApiClientConfig = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  tokenProvider?: ApiTokenProvider;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  retry?: ApiRetryConfig;
  onUnauthorized?: (
    error: unknown,
    context: ApiRequestContext,
  ) => Promise<ApiUnauthorizedResult> | ApiUnauthorizedResult;
  beforeRequest?: (
    init: RequestInit,
    context: ApiRequestContext,
  ) => Promise<RequestInit | void> | RequestInit | void;
  afterResponse?: (
    response: Response,
    context: ApiResponseContext,
  ) => Promise<void> | void;
  onError?: (error: unknown, context: ApiRequestContext) => Promise<void> | void;
};

export type ApiClient = {
  request: <TResponse = unknown>(
    path: string,
    options?: ApiRequestOptions,
  ) => Promise<TResponse>;
  get: <TResponse = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => Promise<TResponse>;
  post: <TResponse = unknown>(
    path: string,
    body?: ApiRequestBody,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => Promise<TResponse>;
  put: <TResponse = unknown>(
    path: string,
    body?: ApiRequestBody,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => Promise<TResponse>;
  patch: <TResponse = unknown>(
    path: string,
    body?: ApiRequestBody,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => Promise<TResponse>;
  delete: <TResponse = unknown>(
    path: string,
    options?: Omit<ApiRequestOptions, "method">,
  ) => Promise<TResponse>;
};
