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
    signOut: string;
    signingOut: string;
  };
  saas: SaasMessages;
  tenant: TenantMessages;
};
