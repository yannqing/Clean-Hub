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

type SaasShellCopy = ShellCopy & {
  header: {
    searchLabel: string;
    searchPlaceholder: string;
    assistantLabel: string;
    accountLabel: string;
    assistant: {
      title: string;
      description: string;
      closeLabel: string;
      searchLabel: string;
      searchPlaceholder: string;
      quickActionsTitle: string;
      emptyTitle: string;
      emptyDescription: string;
      actions: {
        overview: {
          label: string;
          description: string;
        };
        tenants: {
          label: string;
          description: string;
        };
        users: {
          label: string;
          description: string;
        };
        feedbackTickets: {
          label: string;
          description: string;
        };
        todos: {
          label: string;
          description: string;
        };
        auditLogs: {
          label: string;
          description: string;
        };
        operationLogs: {
          label: string;
          description: string;
        };
        security: {
          label: string;
          description: string;
        };
        settings: {
          label: string;
          description: string;
        };
      };
    };
    account: {
      menuLabel: string;
      roleLabel: string;
      profile: string;
      settings: string;
    };
  };
};

type TenantShellCopy = ShellCopy & {
  header: {
    searchLabel: string;
    searchPlaceholder: string;
    assistantLabel: string;
    messagesLabel: string;
    accountLabel: string;
    assistant: {
      title: string;
      description: string;
      closeLabel: string;
      searchLabel: string;
      searchPlaceholder: string;
      recommendedTitle: string;
      quickActionsTitle: string;
      emptyTitle: string;
      emptyDescription: string;
      actions: {
        orders: {
          label: string;
          description: string;
        };
        customers: {
          label: string;
          description: string;
        };
        products: {
          label: string;
          description: string;
        };
        newProduct: {
          label: string;
          description: string;
        };
        services: {
          label: string;
          description: string;
        };
        newService: {
          label: string;
          description: string;
        };
        discounts: {
          label: string;
          description: string;
        };
        newDiscount: {
          label: string;
          description: string;
        };
        reports: {
          label: string;
          description: string;
        };
        finance: {
          label: string;
          description: string;
        };
        settings: {
          label: string;
          description: string;
        };
      };
    };
    messages: {
      title: string;
      unreadCount: string;
      noUnread: string;
      markAllRead: string;
      marking: string;
      loading: string;
      errorTitle: string;
      errorHint: string;
      retry: string;
      emptyTitle: string;
      emptyHint: string;
      businessType: string;
      systemType: string;
      unreadStatus: string;
      readStatus: string;
      markRead: string;
      relatedOrder: string;
      viewAll: string;
    };
    account: {
      menuLabel: string;
      roleLabel: string;
      branchScopeLabel: string;
      allBranches: string;
      assignedBranches: string;
      profile: string;
      employees: string;
      settings: string;
    };
  };
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
  identifierLabel: string;
  identifierPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordShow: string;
  passwordHide: string;
  submit: string;
  submitting: string;
  signedIn: string;
  validation: {
    identifierRequired: string;
    identifierInvalid: string;
    passwordRequired: string;
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
    saas: SaasShellCopy;
    tenant: TenantShellCopy;
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
      fr: string;
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
