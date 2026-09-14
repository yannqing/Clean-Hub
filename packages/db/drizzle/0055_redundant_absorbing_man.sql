-- Smallest note or coin the till stocks, in major units.
--
-- A West African drawer carries no coin below 5 F CFA, so a 52 F CFA cash sale
-- cannot be settled exactly. The cashier may round the cash down to a multiple
-- of this step; the concession is recorded on the order as a rounding
-- adjustment. Electronic payments ignore it — mobile money has no such limit.
--
-- Defaults to 1 (no rounding offered) so existing branches keep today's
-- behaviour until a store sets its own note size.
--
-- The receipt_fields constraint is rebuilt here because `expected_pickup` was
-- added to the allowed set when pickup time became receipt content.
ALTER TABLE "branches" DROP CONSTRAINT "branches_receipt_fields_valid_check";--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "receipt_fields" SET DEFAULT ARRAY['merchant_name', 'branch_name', 'receipt_title', 'receipt_number', 'order_number', 'issued_at', 'customer_name', 'item_name', 'item_quantity', 'item_line_total', 'item_notes', 'subtotal', 'discount', 'taxable_amount', 'tax', 'tax_registration_number', 'tax_exemption_reason', 'rounding', 'total', 'paid_amount', 'cash_tendered', 'change', 'balance', 'payment_method', 'expected_pickup', 'receipt_address', 'receipt_phone', 'thank_you_message']::text[];--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "cash_rounding_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_cash_rounding_step_positive_check" CHECK ("branches"."cash_rounding_step" >= 1);--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_receipt_fields_valid_check" CHECK ("branches"."receipt_fields" <@ ARRAY['merchant_name', 'branch_name', 'receipt_title', 'receipt_number', 'order_number', 'issued_at', 'cashier_name', 'terminal_name', 'customer_name', 'item_name', 'item_quantity', 'item_unit_price', 'item_line_total', 'item_sku', 'item_barcode', 'item_notes', 'subtotal', 'discount', 'taxable_amount', 'tax', 'tax_registration_number', 'tax_exemption_reason', 'rounding', 'total', 'paid_amount', 'cash_tendered', 'change', 'balance', 'payment_method', 'expected_pickup', 'receipt_address', 'receipt_phone', 'thank_you_message']::text[]);
