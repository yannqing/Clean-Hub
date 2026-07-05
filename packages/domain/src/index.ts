export const orderStatuses = [
  "received",
  "in_progress",
  "quality_check",
  "ready",
  "delivered"
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export * from "./permissions";
export * from "./roles";
