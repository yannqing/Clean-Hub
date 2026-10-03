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
      platformSettingsSections: {
        defaults: "/saas/config/platform-settings",
        taxTemplates: "/saas/config/platform-settings/tax-templates",
        security: "/saas/config/platform-settings/security",
        maintenance: "/saas/config/platform-settings/maintenance",
      },
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
    order: (orderId: string) => `/tenant/orders/${encodeURIComponent(orderId)}`,
    customers: "/tenant/customers",
    customer: (customerId: string) =>
      `/tenant/customers/${encodeURIComponent(customerId)}`,
    customerFromAccount: (customerId: string, accountId: string) =>
      `/tenant/customers/${encodeURIComponent(customerId)}?sourceAccountId=${encodeURIComponent(accountId)}`,
    customerAccounts: "/tenant/customers/accounts",
    customerAccount: (accountId: string) =>
      `/tenant/customers/accounts/${encodeURIComponent(accountId)}`,
    users: "/tenant/users",
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
      device: (terminalId: string) =>
        `/tenant/point-of-sale/devices/${encodeURIComponent(terminalId)}`,
      hardware: "/tenant/point-of-sale/hardware",
      newHardware: "/tenant/point-of-sale/hardware/new",
      hardwareDevice: (hardwareId: string) =>
        `/tenant/point-of-sale/hardware/${encodeURIComponent(hardwareId)}`,
      registerSessions: "/tenant/point-of-sale/register-sessions",
    },
    branches: "/tenant/branches",
    services: "/tenant/services",
    newService: "/tenant/services/new",
    service: (serviceId: string) =>
      `/tenant/services/${encodeURIComponent(serviceId)}`,
    hardware: "/tenant/point-of-sale/hardware",
    newHardware: "/tenant/point-of-sale/hardware/new",
    hardwareDevice: (hardwareId: string) =>
      `/tenant/point-of-sale/hardware/${encodeURIComponent(hardwareId)}`,
    notifications: "/tenant/notifications",
    reports: "/tenant/reports",
    finance: "/tenant/finance",
    config: {
      branches: "/tenant/branches",
      services: "/tenant/services",
      hardware: "/tenant/point-of-sale/hardware",
    },
    system: {
      logs: "/tenant/system/logs",
      auditLog: (logId: string) =>
        `/tenant/system/logs/${encodeURIComponent(logId)}`,
      backups: "/tenant/system/backups",
      settings: "/tenant/system/settings",
      settingsSections: {
        general: "/tenant/system/settings",
        pricing: "/tenant/system/settings/pricing",
        payments: "/tenant/system/settings/payments",
        cash: "/tenant/system/settings/cash",
        pointOfSale: "/tenant/system/settings/point-of-sale",
        printing: "/tenant/system/settings/printing",
        hardware: "/tenant/point-of-sale/hardware",
      },
      preferences: "/tenant/system/preferences",
    },
  },
} as const;
