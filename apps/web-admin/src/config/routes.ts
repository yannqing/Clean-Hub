export const webAdminRoutes = {
  home: "/",
  login: "/login",
  apiHealth: "/api-health",
  saas: {
    home: "/saas",
    profile: "/saas/profile",
    tenants: "/saas/tenants",
    newTenant: "/saas/tenants/new",
    tenant: (tenantId: string) =>
      `/saas/tenants/${encodeURIComponent(tenantId)}`,
    tenantSettings: (tenantId: string) =>
      `/saas/tenants/${encodeURIComponent(tenantId)}/settings`,
    users: "/saas/users",
    newUser: "/saas/users/new",
    user: (userId: string) => `/saas/users/${encodeURIComponent(userId)}`,
    editUser: (userId: string) =>
      `/saas/users/${encodeURIComponent(userId)}/edit`,
    auditLogs: "/saas/audit-logs",
    auditLog: (logId: string) =>
      `/saas/audit-logs/${encodeURIComponent(logId)}`,
    feedbackTickets: "/saas/feedback-tickets",
    feedbackTicket: (ticketId: string) =>
      `/saas/feedback-tickets/${encodeURIComponent(ticketId)}`,
    todos: "/saas/todos",
    config: {
      tenants: "/saas/tenants",
      featureFlags: "/saas/config/feature-flags",
      localization: "/saas/config/localization",
      platformSettings: "/saas/config/platform-settings",
    },
    system: {
      logs: "/saas/system/logs",
      operationLog: (logId: string) =>
        `/saas/system/logs/${encodeURIComponent(logId)}`,
      backups: "/saas/system/backups",
      security: "/saas/system/security",
      securityEvent: (eventId: string) =>
        `/saas/system/security/${encodeURIComponent(eventId)}`,
    },
  },
  tenant: {
    home: "/tenant",
    profile: "/tenant/profile",
    orders: "/tenant/orders",
    customers: "/tenant/customers",
    products: "/tenant/products",
    newProduct: "/tenant/products/new",
    product: (productId: string) =>
      `/tenant/products/${encodeURIComponent(productId)}`,
    discounts: "/tenant/discounts",
    newDiscount: "/tenant/discounts/new",
    discount: (discountId: string) =>
      `/tenant/discounts/${encodeURIComponent(discountId)}`,
    pointOfSale: {
      home: "/tenant/point-of-sale",
      devices: "/tenant/point-of-sale/devices",
      registerSessions: "/tenant/point-of-sale/register-sessions",
      settings: "/tenant/point-of-sale/settings",
    },
    branches: "/tenant/branches",
    services: "/tenant/services",
    newService: "/tenant/services/new",
    hardware: "/tenant/hardware",
    newHardware: "/tenant/hardware/new",
    hardwareDevice: (hardwareId: string) =>
      `/tenant/hardware/${encodeURIComponent(hardwareId)}`,
    notifications: "/tenant/notifications",
    reports: "/tenant/reports",
    finance: "/tenant/finance",
    config: {
      branches: "/tenant/branches",
      services: "/tenant/services",
      hardware: "/tenant/hardware",
    },
    system: {
      logs: "/tenant/system/logs",
      auditLog: (logId: string) =>
        `/tenant/system/logs/${encodeURIComponent(logId)}`,
      backups: "/tenant/system/backups",
      settings: "/tenant/system/settings",
      settingsSections: {
        general: "/tenant/system/settings",
        locations: "/tenant/system/settings/locations",
        pricing: "/tenant/system/settings/pricing",
        pointOfSale: "/tenant/system/settings/point-of-sale",
        hardware: "/tenant/system/settings/hardware",
        activityLog: "/tenant/system/settings/activity-log",
      },
      preferences: "/tenant/system/preferences",
    },
  },
} as const;
