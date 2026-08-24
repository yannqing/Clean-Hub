export const orderStatuses = [
  "received",
  "in_progress",
  "quality_check",
  "ready",
  "delivered"
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export * from "./order-codes";
export * from "./permissions";
export * from "./pin";
export * from "./pos-terminal-status";
export * from "./roles";
export * from "./timezone";
