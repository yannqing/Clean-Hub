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
    { label: "Prices", href: webAdminRoutes.tenant.prices },
    { label: "Hardware", href: webAdminRoutes.tenant.hardware },
    { label: "Reports", href: webAdminRoutes.tenant.reports },
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
    { label: "Reports", href: webAdminRoutes.tenant.reports },
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
        { label: "Reports", href: webAdminRoutes.tenant.reports },
      ],
    },
    {
      title: "Configuration Management",
      items: [
        {
          label: "Branch Settings",
          href: webAdminRoutes.tenant.config.branches,
        },
        {
          label: "Service Catalog",
          href: webAdminRoutes.tenant.config.services,
        },
        { label: "Price Books", href: webAdminRoutes.tenant.config.prices },
        {
          label: "Hardware Devices",
          href: webAdminRoutes.tenant.config.hardware,
        },
        {
          label: "Notifications",
          href: webAdminRoutes.tenant.config.notifications,
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
