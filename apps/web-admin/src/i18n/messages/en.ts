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
              label: "Audit logs",
              description: "Trace important platform and account changes.",
            },
            operationLogs: {
              label: "Operation logs",
              description: "Inspect application and service activity.",
            },
            security: {
              label: "Security",
              description: "Review security policy and recent events.",
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
