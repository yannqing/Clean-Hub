import { webAdminRoutes } from "@/config/routes";

import { saasMessagesEn } from "./saas/en";
import { tenantMessagesEn } from "./tenant/en";
import type { SaasMessages } from "./saas";
import type { TenantMessages } from "./tenant";
import type { WebAdminMessages } from "../messages-types";

/**
 * English message bundle.
 *
 * This module is loaded eagerly (it is the default locale and the SSR/first-
 * paint fallback), so it lives in the main client chunk. Non-default locales
 * are loaded on demand from their own modules (e.g. `./zh-CN.ts`) so their
 * catalogs don't bloat the initial bundle.
 */
export const enMessages: WebAdminMessages = {
  shell: {
    saas: {
      eyebrow: "SaaS Admin",
      title: "Platform Operations",
      description:
        "Manage tenants, platform users, configuration, logs, and system controls.",
      header: {
        searchLabel: "Search the platform workspace",
        searchPlaceholder: "Search tenants, users, tickets, or settings...",
        assistantLabel: "CleanHub assistant",
        accountLabel: "Signed-in user",
        assistant: {
          title: "CleanHub assistant",
          description:
            "Quickly open common platform pages and operational tools.",
          closeLabel: "Close assistant",
          searchLabel: "Search platform actions",
          searchPlaceholder: "Search tenants, users, logs...",
          quickActionsTitle: "Platform shortcuts",
          emptyTitle: "No matching action",
          emptyDescription:
            "Try a destination such as tenants, users, tickets, or security.",
          actions: {
            overview: {
              label: "Overview",
              description: "Review platform activity and key indicators.",
            },
            tenants: {
              label: "Tenants",
              description: "Manage tenant accounts and platform access.",
            },
            users: {
              label: "Platform users",
              description: "Manage SaaS operators and their roles.",
            },
            feedbackTickets: {
              label: "Feedback tickets",
              description: "Review and resolve incoming support requests.",
            },
            todos: {
              label: "My todo",
              description: "Open outstanding platform work in one place.",
            },
            auditLogs: {
              label: "Audit & security",
              description: "Review activity records and security events.",
            },
            operationLogs: {
              label: "Operation logs",
              description: "Inspect application and service activity.",
            },
            settings: {
              label: "Platform settings",
              description: "Configure platform-wide defaults and behavior.",
            },
          },
        },
        account: {
          menuLabel: "Open account menu",
          roleLabel: "Role",
          profile: "Personal center",
          settings: "Platform settings",
        },
      },
    },
    tenant: {
      eyebrow: "Tenant Admin",
      title: "Store Operations",
      description:
        "Manage branches, staff, service configuration, reports, and tenant settings.",
      header: {
        searchLabel: "Search the tenant workspace",
        searchPlaceholder: "Search branches, users, or services...",
        assistantLabel: "CleanHub assistant",
        messagesLabel: "Messages",
        accountLabel: "Signed-in user",
        assistant: {
          title: "CleanHub assistant",
          description:
            "Find common pages and actions in the tenant workspace. This assistant navigates CleanHub; it does not generate AI answers.",
          closeLabel: "Close assistant",
          searchLabel: "Search actions",
          searchPlaceholder: "Search orders, products, settings...",
          recommendedTitle: "Useful on this page",
          quickActionsTitle: "All shortcuts",
          emptyTitle: "No matching action",
          emptyDescription: "Try a page or action name such as orders or reports.",
          actions: {
            orders: {
              label: "Orders",
              description: "Review orders across accessible branches.",
            },
            customers: {
              label: "Customers",
              description: "Open the tenant customer directory.",
            },
            products: {
              label: "Products",
              description: "Review product, price, and inventory information.",
            },
            newProduct: {
              label: "Add product",
              description: "Create a new physical product.",
            },
            services: {
              label: "Services",
              description: "Review the service catalog.",
            },
            newService: {
              label: "Add service",
              description: "Create a service for sale.",
            },
            discounts: {
              label: "Discounts",
              description: "Review active and scheduled discounts.",
            },
            newDiscount: {
              label: "Create discount",
              description: "Set up a new discount rule.",
            },
            reports: {
              label: "Reports",
              description: "Review business performance and trends.",
            },
            finance: {
              label: "Finance",
              description: "Open sales, payout, and finance summaries.",
            },
            settings: {
              label: "Tenant settings",
              description: "Manage tenant and branch configuration.",
            },
          },
        },
        messages: {
          title: "Messages",
          unreadCount: "{count} unread",
          noUnread: "You're all caught up",
          markAllRead: "Mark all as read",
          marking: "Updating...",
          loading: "Loading messages...",
          errorTitle: "Messages could not be loaded",
          errorHint: "Check the connection and try again.",
          retry: "Try again",
          emptyTitle: "No messages yet",
          emptyHint: "New tenant notifications will appear here.",
          businessType: "Business",
          systemType: "System",
          unreadStatus: "Unread",
          readStatus: "Read",
          markRead: "Mark as read",
          relatedOrder: "Open orders",
          viewAll: "View all notifications",
        },
        account: {
          menuLabel: "Open account menu",
          roleLabel: "Role",
          branchScopeLabel: "Branch access",
          allBranches: "All branches",
          assignedBranches: "{count} assigned branches",
          profile: "Personal center",
          loadingProfile: "Loading personal center…",
          employees: "Employee management",
          settings: "Tenant settings",
        },
      },
    },
  },
  sidebar: {
    saas: [
      {
        title: "Main",
        items: [
          { label: "Home", href: webAdminRoutes.saas.home },
          {
            label: "Tenant Management",
            href: webAdminRoutes.saas.config.tenants,
          },
          { label: "User Management", href: webAdminRoutes.saas.users },
          {
            label: "Feedback Tickets",
            href: webAdminRoutes.saas.feedbackTickets,
          },
          { label: "My Todo", href: webAdminRoutes.saas.todos },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Feature Flags",
            href: webAdminRoutes.saas.config.featureFlags,
          },
          {
            label: "Localization",
            href: webAdminRoutes.saas.config.localization,
          },
          {
            label: "Platform Settings",
            href: webAdminRoutes.saas.config.platformSettings,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Audit & Security", href: webAdminRoutes.saas.auditLogs },
          { label: "Operation Logs", href: webAdminRoutes.saas.system.logs },
          { label: "Data Backups", href: webAdminRoutes.saas.system.backups },
        ],
      },
    ],
    tenant: [
      {
        title: "Main",
        items: [
          { label: "Home", href: webAdminRoutes.tenant.home },
          { label: "Orders", href: webAdminRoutes.tenant.orders },
          { label: "Customers", href: webAdminRoutes.tenant.customers },
          { label: "Staff", href: webAdminRoutes.tenant.users },
          { label: "Products", href: webAdminRoutes.tenant.products },
          { label: "Discounts", href: webAdminRoutes.tenant.discounts },
          {
            label: "Point of sale",
            href: webAdminRoutes.tenant.pointOfSale.home,
          },
          { label: "Reports", href: webAdminRoutes.tenant.reports },
          { label: "Finance", href: webAdminRoutes.tenant.finance },
        ],
      },
      {
        title: "Stores & devices",
        items: [
          {
            label: "Branches",
            href: webAdminRoutes.tenant.config.branches,
          },
          {
            label: "Notifications",
            href: webAdminRoutes.tenant.notifications,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Operation Logs", href: webAdminRoutes.tenant.system.logs },
          { label: "Data Backups", href: webAdminRoutes.tenant.system.backups },
          {
            label: "Tenant Settings",
            href: webAdminRoutes.tenant.system.settings,
          },
        ],
      },
    ],
  },
  common: {
    personalCenter: "Personal Center",
    language: "Language",
    languageLabels: {
      en: "English",
      fr: "French",
      zhCN: "Simplified Chinese",
    },
    theme: "Theme",
    switchToDarkTheme: "Switch to dark theme",
    switchToLightTheme: "Switch to light theme",
    signOut: "Sign out",
    signingOut: "Signing out...",
    auditCategories: {
      auth: "Sign-in and auth",
      saas_platform: "SaaS platform",
      saas_tenant: "SaaS tenants",
      saas_user: "SaaS users",
      tenant_branch: "Branches",
      tenant_user: "Staff accounts",
      tenant_service: "Services",
      tenant_price: "Prices",
      tenant_hardware: "Peripheral setup",
      tenant_notification: "Notification settings",
      tenant_settings: "Tenant settings",
      tenant_product: "Products",
      tenant_customer: "Customer records",
      tenant_order: "Order comments",
      tenant_backup: "Backups",
      pos_order: "POS orders",
      pos_service_ticket: "Service tickets",
      pos_customer: "Customer accounts",
      pos_hardware: "POS hardware",
      pos_terminal_security: "Terminal security",
      pos_shift: "Shifts",
      pos_register: "Register",
      pos_notification: "POS notifications",
      pos_channel_settings: "POS channel settings",
    },
    auditEvents: {
      "auth.login.success": "User signed in",
      "auth.login.failed": "User sign-in failed",
      "auth.logout": "User signed out",
      "auth.refresh.reuse_detected": "Refresh token reuse detected",
      "auth.pos_pin_login.success": "Cashier signed in with PIN",
      "auth.pos_pin_login.failed": "Cashier PIN sign-in failed",
      "platform_settings.updated": "Platform settings updated",
      "security_settings.updated": "Security settings updated",
      "security.settings.updated": "Security settings updated",
      "backup_job.created": "Backup job created",
      "restore_request.created": "Restore request created",
      "feedback_ticket.status_updated": "Feedback ticket status updated",
      "feedback_ticket.assignee_updated": "Feedback ticket assignee updated",
      "tenant.created": "Tenant created",
      "tenant.updated": "Tenant updated",
      "tenant.status_updated": "Tenant status updated",
      "tenant_settings.updated": "Tenant settings updated",
      "tenant_feature_flags.updated": "Tenant feature flags updated",
      "saas_user.created": "SaaS user created",
      "saas_user.updated": "SaaS user updated",
      "saas_user.roles_updated": "SaaS user roles updated",
      "saas_user.status_updated": "SaaS user status updated",
      "branch.created": "Branch created",
      "branch.updated": "Branch updated",
      "branch.status_changed": "Branch status changed",
      "tenant_user.created": "Staff account created",
      "tenant_user.updated": "Staff account updated",
      "tenant_user.disabled": "Staff account disabled",
      "tenant_user.pin_reset": "Staff PIN reset",
      "tenant_user.owner_created": "Owner account created",
      "service.created": "Service created",
      "service.updated": "Service updated",
      "service.status_changed": "Service status changed",
      "service.deleted": "Service deleted",
      "price.created": "Price created",
      "price.updated": "Price updated",
      "price.deleted": "Price deleted",
      "tenant_hardware.created": "Hardware configuration created",
      "tenant_hardware.updated": "Hardware configuration updated",
      "tenant_hardware.deleted": "Hardware configuration deleted",
      "notification_settings.updated": "Notification settings updated",
      "settings.updated": "Settings updated",
      "product.created": "Product created",
      "product.updated": "Product updated",
      "tenant.customer.comment_created": "Comment added to customer",
      "tenant.customer.comment_updated": "Customer comment edited",
      "tenant.order.comment_created": "Comment added to order",
      "pos.order.created": "Order created",
      "pos.order.item_added": "Item added to order",
      "pos.order.payment_created": "Payment recorded",
      "pos.order.payment_refunded": "Payment refunded",
      "pos.order.status_changed": "Order status changed",
      "pos.service_ticket.created": "Service ticket created",
      "pos.service_ticket.item_added": "Item added to ticket",
      "pos.service_ticket.item_updated": "Ticket item updated",
      "pos.service_ticket.item_status_changed": "Ticket item status changed",
      "pos.service_ticket.status_changed": "Ticket status changed",
      "pos.service_ticket.status_synced_from_items":
        "Ticket status followed its items",
      "pos_customer.profile_created": "Customer profile created",
      "pos_customer.account_created": "Customer account created",
      "pos_customer.account_status_changed": "Customer account status changed",
      "pos_customer.account_deleted": "Customer account deleted",
      "pos_hardware.printer.bound": "Printer bound to terminal",
      "pos_hardware.print_job.printed": "Receipt printed",
      "pos_hardware.print_job.failed": "Receipt printing failed",
      "pos_hardware.built_in.connected": "Built-in peripheral connected",
      "pos_hardware.cash_payment_drawer.failed": "Cash drawer failed to open",
      "pos_hardware.privileged_reprint.authorized":
        "Receipt reprint authorised",
      "pos_terminal.enrolled": "Terminal enrolled",
      "pos_terminal.enabled": "Terminal enabled",
      "pos_terminal.disabled": "Terminal disabled",
      "pos_terminal.revoked": "Terminal access revoked",
      "pos_terminal.credential_rotated": "Terminal credential rotated",
      "pos_terminal.credential_re_enrolled": "Terminal credential re-enrolled",
      "pos_terminal.rebound": "Terminal moved to another branch",
      "pos.shift.clock_in": "Staff clocked in",
      "pos.shift.break_start": "Break started",
      "pos.shift.break_end": "Break ended",
      "pos.shift.security_forced_closed":
        "Shift force-closed by a security change",
      "pos.register.opened": "Register opened",
      "pos.notification.read": "Notification read",
      "pos_channel_settings.updated": "POS channel settings updated",
    },
  },
  auth: {
    brandName: "CleanHub Web Admin",
    brandSuffix: "Management Console",
    heroTitle: "Everyday operations, thoughtfully organized.",
    heroDescription:
      "Manage stores, staff, service configuration, reports, and operational settings from one secure place.",
    title: "Welcome back",
    description:
      "Sign in with your work email. CleanHub will take you to the right workspace for your account.",
    identifierLabel: "Email",
    identifierPlaceholder: "admin@cleanhub.local",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    passwordShow: "Show password",
    passwordHide: "Hide password",
    submit: "Sign in",
    submitting: "Signing in...",
    signedIn: "Signed in successfully.",
    validation: {
      identifierRequired: "Email is required.",
      identifierInvalid: "Enter a valid email address.",
      passwordRequired: "Password is required.",
    },
    errors: {
      checkForm: "Please check the login form.",
      accessDenied:
        "This account cannot access CleanHub Web Admin. Sign in with an owner, manager, or platform administrator account.",
      signInFailed:
        "Unable to sign in. Check your account details and try again.",
    },
    redirect: {
      sessionExpired: "Your session has expired. Sign in again.",
      tenantAccessDenied:
        "This account cannot access tenant administration. Sign in with an owner or manager account.",
    },
  },
  saas: saasMessagesEn satisfies SaasMessages,
  tenant: tenantMessagesEn satisfies TenantMessages,
};
