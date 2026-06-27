export type MobileCustomerProfileAddress = {
  customerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  address: string | null;
  status: "active" | "disabled";
};

export type MobileCustomerProfile = {
  account: {
    id: string;
    tenantId: string;
    accountName: string;
    phone: string | null;
    email: string | null;
    status: "active" | "disabled";
  };
  addresses: MobileCustomerProfileAddress[];
};

export type MobileCustomerOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type MobileCustomerTicketStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "ready_to_pick"
  | "picked_up"
  | "cancelled"
  | "exception";

export type MobileCustomerOrderListItem = {
  id: string;
  branchId: string;
  customerId: string;
  status: MobileCustomerOrderStatus;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
  expireAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileCustomerOrderItem = {
  id: string;
  itemName: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  sourceType: string;
  sourceId: string;
};

export type MobileCustomerOrderDetail = MobileCustomerOrderListItem & {
  orderType: string;
  notes: string | null;
  items: MobileCustomerOrderItem[];
};

export type MobileCustomerTicketListItem = {
  id: string;
  branchId: string;
  customerId: string;
  ticketNo: string | null;
  ticketType: string;
  ticketStatus: MobileCustomerTicketStatus;
  expectedPickupAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileCustomerTicketItem = {
  id: string;
  itemName: string;
  itemCategory: string | null;
  itemStatus: string;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
  remark: string | null;
};

export type MobileCustomerTicketDetail = MobileCustomerTicketListItem & {
  priority: string;
  remark: string | null;
  items: MobileCustomerTicketItem[];
};

export type MobileCustomerActivityList = {
  orders: MobileCustomerOrderListItem[];
  tickets: MobileCustomerTicketListItem[];
};

export type MobileCustomerActivityResponse = {
  data: MobileCustomerActivityList;
};

export type MobileCustomerAppointmentStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "done";

export type MobileCustomerAppointmentType = "pickup" | "dropoff";

export type MobileCustomerAppointment = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  type: MobileCustomerAppointmentType;
  status: MobileCustomerAppointmentStatus;
  expectedAt: string;
  address: string;
  notes: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileCreateCustomerAppointmentRequest = {
  type: MobileCustomerAppointmentType;
  expectedAt: string;
  address: string;
  branchId?: string;
  customerId?: string;
  notes?: string;
};

export type MobileCustomerListResponse<T> = {
  data: T[];
};
