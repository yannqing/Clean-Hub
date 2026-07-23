import type { SaasMessages } from "./messages/saas";
import type { TenantMessages } from "./messages/tenant";

/**
 * Shape of the full web-admin message bundle (shell copy + sidebar nav data +
 * shared common copy + the saas/tenant feature catalogs).
 *
 * Extracted to its own module so each per-locale bundle (`./messages/en.ts`,
 * `./messages/zh-CN.ts`) can reference the type without importing the
 * eager/default bundle from `./messages.ts` (which would defeat the locale
 * code-splitting).
 */
type ShellCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

type SidebarSection = {
  title: string;
  items: { label: string; href: string }[];
};

type AuthCopy = {
  brandName: string;
  brandSuffix: string;
  heroTitle: string;
  heroDescription: string;
  title: string;
  description: string;
  signInAs: string;
  tenantModeLabel: string;
  tenantModeDescription: string;
  platformModeLabel: string;
  platformModeDescription: string;
  tenantCodeLabel: string;
  tenantCodePlaceholder: string;
  tenantCodeHint: string;
  platformHint: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  signedIn: string;
  validation: {
    identifierRequired: string;
    passwordRequired: string;
    tenantCodeRequired: string;
  };
  errors: {
    checkForm: string;
    accessDenied: string;
    signInFailed: string;
  };
  redirect: {
    sessionExpired: string;
    tenantAccessDenied: string;
  };
};

export type WebAdminMessages = {
  shell: {
    saas: ShellCopy;
    tenant: ShellCopy;
  };
  sidebar: {
    saas: SidebarSection[];
    tenant: SidebarSection[];
  };
  common: {
    personalCenter: string;
    language: string;
    languageLabels: {
      en: string;
      zhCN: string;
    };
    theme: string;
    switchToDarkTheme: string;
    switchToLightTheme: string;
    signOut: string;
    signingOut: string;
  };
  auth: AuthCopy;
  saas: SaasMessages;
  tenant: TenantMessages;
};
