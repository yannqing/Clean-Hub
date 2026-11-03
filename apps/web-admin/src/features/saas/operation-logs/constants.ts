import type { OperationLogLevel } from "./types";

export const operationLogLevelOptions = [
  { label: "Debug", value: "debug" },
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OperationLogLevel;
}>;

export const operationLogLevelLabels: Record<OperationLogLevel, string> = {
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
};
