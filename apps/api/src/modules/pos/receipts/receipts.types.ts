export type PosReceiptDeliveryChannel = "print" | "email" | "sms" | "none";
export type PosReceiptDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped";

export type DeliverPosReceiptRequest = {
  channel: PosReceiptDeliveryChannel;
  destination?: string;
  idempotencyKey: string;
  printStatus?: "sent" | "failed";
  failureReason?: string;
};

export type PosReceiptDelivery = {
  id: string;
  orderId: string;
  channel: PosReceiptDeliveryChannel;
  destination: string | null;
  status: PosReceiptDeliveryStatus;
  receiptTitle: string;
  provider: string | null;
  externalId: string | null;
  failureReason: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
};
