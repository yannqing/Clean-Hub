import { webAdminRoutes } from "./routes";

export const webAdminNavigation = {
  saas: [
    { label: "Overview", href: webAdminRoutes.saas.home },
    { label: "Tenants", href: webAdminRoutes.saas.tenants },
    { label: "Users", href: webAdminRoutes.saas.users },
    { label: "Audit Logs", href: webAdminRoutes.saas.auditLogs },
    { label: "Feedback Tickets", href: webAdminRoutes.saas.feedbackTickets },
  ],
  tenant: [
    { label: "Overview", href: webAdminRoutes.tenant.home },
    { label: "Branches", href: webAdminRoutes.tenant.branches },
    { label: "Services", href: webAdminRoutes.tenant.services },
    { label: "Discounts", href: webAdminRoutes.tenant.discounts },
    { label: "Notifications", href: webAdminRoutes.tenant.notifications },
    { label: "Point of sale", href: webAdminRoutes.tenant.pointOfSale.home },
    { label: "Reports", href: webAdminRoutes.tenant.reports },
    { label: "Finance", href: webAdminRoutes.tenant.finance },
  ],
} as const;

export const webAdminWorkspaceTabs = {
  saas: [
    { label: "Dashboard", href: webAdminRoutes.saas.home },
    { label: "Tenants", href: webAdminRoutes.saas.tenants },
    { label: "Users", href: webAdminRoutes.saas.users },
    { label: "Logs", href: webAdminRoutes.saas.system.logs },
  ],
  tenant: [
    { label: "Dashboard", href: webAdminRoutes.tenant.home },
    { label: "Branches", href: webAdminRoutes.tenant.branches },
    { label: "Discounts", href: webAdminRoutes.tenant.discounts },
    { label: "Point of sale", href: webAdminRoutes.tenant.pointOfSale.home },
    { label: "Reports", href: webAdminRoutes.tenant.reports },
    { label: "Finance", href: webAdminRoutes.tenant.finance },
  ],
} as const;

export const webAdminSidebarNavigation = {
  saas: [
    {
      title: "Main",
      items: [
        { label: "Dashboard", href: webAdminRoutes.saas.home },
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
        { label: "Dashboard", href: webAdminRoutes.tenant.home },
        {
          label: "Point of sale",
          href: webAdminRoutes.tenant.pointOfSale.home,
        },
        { label: "Discounts", href: webAdminRoutes.tenant.discounts },
        { label: "Reports", href: webAdminRoutes.tenant.reports },
        { label: "Finance", href: webAdminRoutes.tenant.finance },
      ],
    },
    {
      title: "Configuration Management",
      items: [
        {
          label: "Branches",
          href: webAdminRoutes.tenant.config.branches,
        },
        {
          label: "Service Catalog",
          href: webAdminRoutes.tenant.config.services,
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
        {
          label: "Tenant Settings",
          href: webAdminRoutes.tenant.system.settings,
        },
      ],
    },
  ],
} as const;

export const webAdminShellCopy = {
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
  },
} as const;
