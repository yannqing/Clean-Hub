import pino, { type Logger, type LoggerOptions } from "pino";

export type AppLogger = Logger;

export type CreateLoggerOptions = {
  name?: string;
  level?: string;
  environment?: string;
  service?: string;
  options?: LoggerOptions;
};

const DEFAULT_REDACT_PATHS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "headers.authorization",
  "headers.cookie",
];

export function createLogger({
  name,
  level = process.env.LOG_LEVEL ?? "info",
  environment = process.env.NODE_ENV ?? "development",
  service = process.env.SERVICE_NAME ?? "cleanhub",
  options,
}: CreateLoggerOptions = {}): AppLogger {
  const baseOptions: LoggerOptions = {
    name,
    level,
    base: {
      service,
      environment,
    },
    redact: {
      paths: DEFAULT_REDACT_PATHS,
      remove: true,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino({
    ...baseOptions,
    ...options,
  });
}

export const logger = createLogger();
