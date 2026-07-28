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
          { label: "Dashboard", href: webAdminRoutes.saas.home },
          { label: "My Todo", href: webAdminRoutes.saas.todos },
          { label: "User Management", href: webAdminRoutes.saas.users },
          {
            label: "Feedback Tickets",
            href: webAdminRoutes.saas.feedbackTickets,
          },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Tenant Management",
            href: webAdminRoutes.saas.config.tenants,
          },
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
          { label: "Audit Logs", href: webAdminRoutes.saas.auditLogs },
          { label: "Operation Logs", href: webAdminRoutes.saas.system.logs },
          { label: "Data Backups", href: webAdminRoutes.saas.system.backups },
          {
            label: "Security Settings",
            href: webAdminRoutes.saas.system.security,
          },
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
            label: "Peripheral hardware",
            href: webAdminRoutes.tenant.config.hardware,
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
      zhCN: "Simplified Chinese",
    },
    theme: "Theme",
    switchToDarkTheme: "Switch to dark theme",
    switchToLightTheme: "Switch to light theme",
    signOut: "Sign out",
    signingOut: "Signing out...",
  },
  auth: {
    brandName: "CleanHub Web Admin",
    brandSuffix: "Management Console",
    heroTitle: "One workspace for every store.",
    heroDescription:
      "Manage stores, staff, service configuration, reports, and operational settings from one secure place.",
    title: "Welcome back",
    description:
      "Choose store or platform sign-in. Store administrators must also enter their store code.",
    signInAs: "Sign in as",
    tenantModeLabel: "Store admin",
    tenantModeDescription: "Owner or manager for a laundry or pressing store",
    platformModeLabel: "Platform admin",
    platformModeDescription:
      "CleanHub SaaS operations, super administrators, or support",
    tenantCodeLabel: "Store code",
    tenantCodePlaceholder: "e.g. SN-0042",
    tenantCodeHint:
      "The unique store code assigned by CleanHub. Required for store administrators.",
    platformHint:
      "Platform administrators sign in with an email address or phone number and a password. No store code is required.",
    identifierLabel: "Email or phone",
    identifierPlaceholder: "admin@cleanhub.local",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    passwordShow: "Show password",
    passwordHide: "Hide password",
    submit: "Sign in",
    submitting: "Signing in...",
    signedIn: "Signed in successfully.",
    validation: {
      identifierRequired: "Email or phone is required.",
      passwordRequired: "Password is required.",
      tenantCodeRequired: "Store code is required for store login.",
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
