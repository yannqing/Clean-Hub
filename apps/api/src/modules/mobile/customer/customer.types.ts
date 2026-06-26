import type { MobileAuthContext } from "../auth/auth.types.js";

export type CustomerMobileContext = MobileAuthContext & {
  subjectType: "customer";
  role: "customer";
};

export type CustomerProfileAddress = {
  customerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  address: string | null;
  status: "active" | "disabled";
};

export type CustomerProfile = {
  account: {
    id: string;
    tenantId: string;
    accountName: string;
    phone: string | null;
    email: string | null;
    status: "active" | "disabled";
  };
  addresses: CustomerProfileAddress[];
};

export type CustomerOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type CustomerTicketStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "ready_to_pick"
  | "picked_up"
  | "cancelled"
  | "exception";

export type CustomerOrderListItem = {
  id: string;
  branchId: string;
  customerId: string;
  status: CustomerOrderStatus;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
  expireAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOrderItem = {
  id: string;
  itemName: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  sourceType: string;
  sourceId: string;
};

export type CustomerOrderDetail = CustomerOrderListItem & {
  orderType: string;
  notes: string | null;
  items: CustomerOrderItem[];
};

export type CustomerTicketListItem = {
  id: string;
  branchId: string;
  customerId: string;
  ticketNo: string | null;
  ticketType: string;
  ticketStatus: CustomerTicketStatus;
  expectedPickupAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerTicketItem = {
  id: string;
  itemName: string;
  itemCategory: string | null;
  itemStatus: string;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
  remark: string | null;
};

export type CustomerTicketDetail = CustomerTicketListItem & {
  priority: string;
  remark: string | null;
  items: CustomerTicketItem[];
};

export type CustomerActivityList = {
  orders: CustomerOrderListItem[];
  tickets: CustomerTicketListItem[];
};

export type CustomerAppointmentStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "done";

export type CustomerAppointmentType = "pickup" | "dropoff";

export type CustomerAppointment = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  type: CustomerAppointmentType;
  status: CustomerAppointmentStatus;
  expectedAt: string;
  address: string;
  notes: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerAppointmentInput = {
  authContext: MobileAuthContext;
  type: CustomerAppointmentType;
  expectedAt: Date;
  address: string;
  branchId?: string;
  customerId?: string;
  notes?: string;
};

export type CustomerErrorCode =
  | "CUSTOMER_FORBIDDEN"
  | "CUSTOMER_PROFILE_NOT_FOUND"
  | "CUSTOMER_ORDER_NOT_FOUND"
  | "CUSTOMER_TICKET_NOT_FOUND"
  | "CUSTOMER_APPOINTMENT_NOT_FOUND"
  | "CUSTOMER_APPOINTMENT_CONFLICT"
  | "CUSTOMER_VALIDATION_ERROR";

export class CustomerError extends Error {
  constructor(
    readonly code: CustomerErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
