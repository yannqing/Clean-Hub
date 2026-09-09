export const posRoutes = {
  home: "/",
  login: "/login",
  setup: "/setup",
  workspace: "/",
  sale: "/sale",
  newIntake: "/new-intake",
  /**
   * Intake started from a service. The clerk still has to pick the customer,
   * but the service they were looking at rides along so they do not have to
   * find it again once the ticket exists.
   */
  newIntakeForService: (serviceId: string) =>
    `/new-intake?serviceId=${encodeURIComponent(serviceId)}`,
  scan: "/scan",
  customers: "/customers",
  catalog: "/catalog",
  catalogProductDetail: (productSkuId: string) =>
    `/catalog/products/${productSkuId}`,
  catalogServiceDetail: (serviceId: string) =>
    `/catalog/services/${serviceId}`,
  tickets: "/tickets",
  ticketDetail: (ticketId: string) => `/tickets/${ticketId}`,
  orders: "/orders",
  orderDetail: (orderId: string) => `/orders/${orderId}`,
  statistics: "/statistics",
  garments: "/garments",
  shiftHandover: "/shift-handover",
  notifications: "/notifications",
  settings: "/settings",
  settingsTerminal: "/settings/terminal",
  settingsCheckout: "/settings/checkout",
  settingsPrinting: "/settings/printing",
  settingsSecurity: "/settings/security",
  settingsStore: "/settings/store",
  settingsHardware: "/settings/hardware",
} as const;

/**
 * Build the customer service detail URL for a profile.
 * Kept as a helper (not inside the `as const` object) so the static route
 * map stays a plain string record.
 */
export function customerDetailPath(customerId: string): string {
  return `/customers/${customerId}`;
}
