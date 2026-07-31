export const posRoutes = {
  home: "/",
  login: "/login",
  setup: "/setup",
  workspace: "/",
  newIntake: "/new-intake",
  scan: "/scan",
  customers: "/customers",
  tickets: "/tickets",
  ticketDetail: (ticketId: string) => `/tickets/${ticketId}`,
  orders: "/orders",
  orderDetail: (orderId: string) => `/orders/${orderId}`,
  statistics: "/statistics",
  garments: "/garments",
  shiftHandover: "/shift-handover",
  notifications: "/notifications",
  settings: "/settings",
} as const;

/**
 * Build the customer service detail URL for a profile.
 * Kept as a helper (not inside the `as const` object) so the static route
 * map stays a plain string record.
 */
export function customerDetailPath(customerId: string): string {
  return `/customers/${customerId}`;
}
