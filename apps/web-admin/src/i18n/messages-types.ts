import type { SaasMessages } from "./messages/saas";
import type { TenantMessages } from "./messages/tenant";

/**
 * Audit categories emitted by `apps/api`, as they appear in
 * `audit_logs.event_category`.
 */
export type AuditCategoryCode =
  | "auth"
  | "saas_platform"
  | "saas_tenant"
  | "saas_user"
  | "tenant_branch"
  | "tenant_user"
  | "tenant_service"
  | "tenant_price"
  | "tenant_hardware"
  | "tenant_notification"
  | "tenant_settings"
  | "tenant_product"
  | "tenant_customer"
  | "tenant_order"
  | "tenant_backup"
  | "pos_order"
  | "pos_service_ticket"
  | "pos_customer"
  | "pos_hardware"
  | "pos_terminal_security"
  | "pos_shift"
  | "pos_register"
  | "pos_notification"
  | "pos_channel_settings";

/**
 * Audit events described to operators, as they appear in
 * `audit_logs.event_type`.
 *
 * Events the API emits but that are deliberately left undescribed are absent
 * here on purpose -- see `UNDESCRIBED_AUDIT_EVENT_TYPES`. They render as their
 * humanised code rather than carrying a guessed meaning in an audit trail.
 */
export type AuditEventCode =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "auth.refresh.reuse_detected"
  | "auth.pos_pin_login.success"
  | "auth.pos_pin_login.failed"
  | "platform_settings.updated"
  | "security_settings.updated"
  | "security.settings.updated"
  | "backup_job.created"
  | "restore_request.created"
  | "feedback_ticket.status_updated"
  | "feedback_ticket.assignee_updated"
  | "tenant.created"
  | "tenant.updated"
  | "tenant.status_updated"
  | "tenant_settings.updated"
  | "tenant_feature_flags.updated"
  | "saas_user.created"
  | "saas_user.updated"
  | "saas_user.roles_updated"
  | "saas_user.status_updated"
  | "branch.created"
  | "branch.updated"
  | "branch.status_changed"
  | "tenant_user.created"
  | "tenant_user.updated"
  | "tenant_user.disabled"
  | "tenant_user.pin_reset"
  | "tenant_user.owner_created"
  | "service.created"
  | "service.updated"
  | "service.status_changed"
  | "service.deleted"
  | "price.created"
  | "price.updated"
  | "price.deleted"
  | "tenant_hardware.created"
  | "tenant_hardware.updated"
  | "tenant_hardware.deleted"
  | "notification_settings.updated"
  | "settings.updated"
  | "product.created"
  | "product.updated"
  | "tenant.customer.comment_created"
  | "tenant.customer.comment_updated"
  | "tenant.order.comment_created"
  | "pos.order.created"
  | "pos.order.item_added"
  | "pos.order.payment_created"
  | "pos.order.payment_refunded"
  | "pos.order.status_changed"
  | "pos.service_ticket.created"
  | "pos.service_ticket.item_added"
  | "pos.service_ticket.item_updated"
  | "pos.service_ticket.item_status_changed"
  | "pos.service_ticket.status_changed"
  | "pos_customer.profile_created"
  | "pos_customer.account_created"
  | "pos_customer.account_status_changed"
  | "pos_customer.account_deleted"
  | "pos_hardware.printer.bound"
  | "pos_hardware.print_job.printed"
  | "pos_hardware.print_job.failed"
  | "pos_hardware.built_in.connected"
  | "pos_hardware.cash_payment_drawer.failed"
  | "pos_terminal.enrolled"
  | "pos_terminal.enabled"
  | "pos_terminal.disabled"
  | "pos_terminal.revoked"
  | "pos_terminal.credential_rotated"
  | "pos_terminal.credential_re_enrolled"
  | "pos.shift.clock_in"
  | "pos.shift.break_start"
  | "pos.shift.break_end"
  | "pos.register.opened"
  | "pos.notification.read"
  | "pos_channel_settings.updated";

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
      loadingProfile: string;
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
    /**
     * Audit copy lives in the shared namespace because both consoles render the
     * same feed: the tenant log and the SaaS log describe the same events from
     * the same table. Keys are the raw `eventType` / `eventCategory` codes the
     * API emits, so a missing translation is a compile error rather than a
     * silent fallback to English.
     */
    auditCategories: Record<AuditCategoryCode, string>;
    auditEvents: Record<AuditEventCode, string>;
  };
  auth: AuthCopy;
  saas: SaasMessages;
  tenant: TenantMessages;
};
