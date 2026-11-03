import type {
  SaasUserLanguage,
  SaasUserRoleCode,
  SaasUserStatus,
} from "./types";

export const saasUserStatusLabels: Record<SaasUserStatus, string> = {
  active: "Active",
  disabled: "Disabled",
  invited: "Invited",
  suspended: "Suspended",
};

export const saasUserStatusOptions: Array<{
  label: string;
  value: SaasUserStatus;
}> = [
  { label: saasUserStatusLabels.active, value: "active" },
  { label: saasUserStatusLabels.invited, value: "invited" },
  { label: saasUserStatusLabels.disabled, value: "disabled" },
  { label: saasUserStatusLabels.suspended, value: "suspended" },
];

export const saasUserRoleLabels: Record<
  SaasUserRoleCode | "unassigned",
  string
> = {
  support: "Support",
  super_admin: "Super Admin",
  unassigned: "Unassigned",
};

export const saasUserLanguageLabels: Record<SaasUserLanguage | string, string> =
  {
    en: "English",
    fr: "French",
    "zh-CN": "Chinese",
  };
