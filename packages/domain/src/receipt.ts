export const POS_RECEIPT_FIELDS = [
  "merchant_name",
  "branch_name",
  "receipt_title",
  "receipt_number",
  "order_number",
  "issued_at",
  "cashier_name",
  "terminal_name",
  "customer_name",
  "item_name",
  "item_quantity",
  "item_unit_price",
  "item_line_total",
  "item_sku",
  "item_barcode",
  "item_notes",
  "subtotal",
  "discount",
  "taxable_amount",
  "tax",
  "tax_registration_number",
  "tax_exemption_reason",
  "rounding",
  "total",
  "paid_amount",
  "cash_tendered",
  "change",
  "balance",
  "payment_method",
  "expected_pickup",
  "receipt_address",
  "receipt_phone",
  "thank_you_message",
] as const;

export type PosReceiptField = (typeof POS_RECEIPT_FIELDS)[number];

export const REQUIRED_POS_RECEIPT_FIELDS = [
  "merchant_name",
] as const satisfies readonly PosReceiptField[];

/**
 * Existing receipt content stays enabled after the setting is introduced.
 * Cashier, terminal, unit price, SKU and barcode are useful optional details,
 * but remain opt-in so current stores do not unexpectedly receive longer slips.
 */
export const DEFAULT_POS_RECEIPT_FIELDS = [
  "merchant_name",
  "branch_name",
  "receipt_title",
  "receipt_number",
  "order_number",
  "issued_at",
  "customer_name",
  "item_name",
  "item_quantity",
  "item_line_total",
  "item_notes",
  "subtotal",
  "discount",
  "taxable_amount",
  "tax",
  "tax_registration_number",
  "tax_exemption_reason",
  "rounding",
  "total",
  "paid_amount",
  "cash_tendered",
  "change",
  "balance",
  "payment_method",
  "expected_pickup",
  "receipt_address",
  "receipt_phone",
  "thank_you_message",
] as const satisfies readonly PosReceiptField[];

const POS_RECEIPT_FIELD_SET = new Set<string>(POS_RECEIPT_FIELDS);

export function normalizePosReceiptFields(
  fields: readonly string[] | null | undefined,
): PosReceiptField[] {
  const normalized = Array.from(
    new Set(
      (fields ?? DEFAULT_POS_RECEIPT_FIELDS).filter(
        (field): field is PosReceiptField => POS_RECEIPT_FIELD_SET.has(field),
      ),
    ),
  );

  for (const required of REQUIRED_POS_RECEIPT_FIELDS) {
    if (!normalized.includes(required)) normalized.unshift(required);
  }

  return normalized;
}

export const POS_TICKET_LABEL_FIELDS = [
  "merchant_name",
  "branch_name",
  "ticket_number",
  "customer_name",
  "item_count",
  "item_name",
  "item_measurement",
  "item_price",
  "item_color",
  "item_defect",
  "item_request",
  "label_code",
  "expected_pickup_at",
] as const;

export type PosTicketLabelField = (typeof POS_TICKET_LABEL_FIELDS)[number];

export const REQUIRED_POS_TICKET_LABEL_FIELDS = [
  "ticket_number",
  "item_name",
] as const satisfies readonly PosTicketLabelField[];

/** Preserve the content that was printed before label configuration existed. */
export const DEFAULT_POS_TICKET_LABEL_FIELDS = [
  "merchant_name",
  "ticket_number",
  "customer_name",
  "item_count",
  "item_name",
  "item_measurement",
  "item_price",
  "item_color",
  "item_defect",
  "item_request",
  "label_code",
  "expected_pickup_at",
] as const satisfies readonly PosTicketLabelField[];

const POS_TICKET_LABEL_FIELD_SET = new Set<string>(POS_TICKET_LABEL_FIELDS);

export function normalizePosTicketLabelFields(
  fields: readonly string[] | null | undefined,
): PosTicketLabelField[] {
  const normalized = Array.from(
    new Set(
      (fields ?? DEFAULT_POS_TICKET_LABEL_FIELDS).filter(
        (field): field is PosTicketLabelField =>
          POS_TICKET_LABEL_FIELD_SET.has(field),
      ),
    ),
  );

  for (const required of REQUIRED_POS_TICKET_LABEL_FIELDS) {
    if (!normalized.includes(required)) normalized.unshift(required);
  }

  return normalized;
}
