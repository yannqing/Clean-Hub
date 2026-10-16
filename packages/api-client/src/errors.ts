import type { HttpMethod } from "./types";

export type ApiFieldError = {
  field: string;
  message: string;
  code?: string;
};

export type ApiErrorDetails = {
  message?: string;
  code?: string;
  lockedUntil?: string;
  requestId?: string;
  validationErrors?: ApiFieldError[];
};

export class ApiClientError extends Error {
  readonly requestId?: string;

  constructor(message: string, options: { requestId?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiClientError";
    this.requestId = options.requestId;
  }
}

export class ApiHttpError<TResponse = unknown> extends ApiClientError {
  readonly status: number;
  readonly statusText: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly code?: string;
  readonly lockedUntil?: string;
  readonly responseData?: TResponse;
  readonly validationErrors?: ApiFieldError[];

  constructor({
    message,
    status,
    statusText,
    method,
    url,
    requestId,
    code,
    lockedUntil,
    responseData,
    validationErrors,
  }: {
    message: string;
    status: number;
    statusText: string;
    method: HttpMethod;
    url: string;
    requestId?: string;
    code?: string;
    lockedUntil?: string;
    responseData?: TResponse;
    validationErrors?: ApiFieldError[];
  }) {
    super(message, { requestId });
    this.name = "ApiHttpError";
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
    this.code = code;
    this.lockedUntil = lockedUntil;
    this.responseData = responseData;
    this.validationErrors = validationErrors;
  }
}

export class ApiNetworkError extends ApiClientError {
  constructor(message: string, options: { requestId?: string; cause?: unknown } = {}) {
    super(message, options);
    this.name = "ApiNetworkError";
  }
}

export class ApiTimeoutError extends ApiClientError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options: { requestId?: string; cause?: unknown } = {}) {
    super(`API request timed out after ${timeoutMs}ms.`, options);
    this.name = "ApiTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class ApiParseError extends ApiClientError {
  readonly status: number;
  readonly url: string;

  constructor({
    message,
    status,
    url,
    requestId,
    cause,
  }: {
    message: string;
    status: number;
    url: string;
    requestId?: string;
    cause?: unknown;
  }) {
    super(message, { requestId, cause });
    this.name = "ApiParseError";
    this.status = status;
    this.url = url;
  }
}

export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}

export function isApiTimeoutError(error: unknown): error is ApiTimeoutError {
  return error instanceof ApiTimeoutError;
}

export function isApiNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError;
}
