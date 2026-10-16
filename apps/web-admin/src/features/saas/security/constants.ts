import type {
  SecurityEventSeverity,
  SecuritySettingsFormValues,
} from "./types";

export const securityEventSeverityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: SecurityEventSeverity;
}>;

export const securityEventSeverityLabels: Record<SecurityEventSeverity, string> =
  {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };

export const securitySettingsDefaultValues: SecuritySettingsFormValues = {
  passwordMinLength: 8,
  passwordRequiresNumber: true,
  passwordRequiresSymbol: false,
  loginMaxAttempts: 5,
  lockoutMinutes: 15,
  refreshTokenDays: 30,
};
