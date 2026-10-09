CREATE TABLE "order_discount_idempotency_receipts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"application_id" varchar(26) NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"intent_kind" varchar(20) NOT NULL,
	"intent_value" varchar(100) NOT NULL,
	"reason_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	CONSTRAINT "order_discount_idempotency_receipts_intent_kind_check" CHECK ("order_discount_idempotency_receipts"."intent_kind" in ('code', 'discount_id')),
	CONSTRAINT "order_discount_idempotency_receipts_intent_value_check" CHECK (length(btrim("order_discount_idempotency_receipts"."intent_value")) > 0),
	CONSTRAINT "order_discount_idempotency_receipts_reason_check" CHECK ("order_discount_idempotency_receipts"."reason_snapshot" is null
        or length(btrim("order_discount_idempotency_receipts"."reason_snapshot")) > 0)
);
--> statement-breakpoint
ALTER TABLE "order_discount_idempotency_receipts" ADD CONSTRAINT "order_discount_idempotency_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_idempotency_receipts" ADD CONSTRAINT "order_discount_idempotency_receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_idempotency_receipts" ADD CONSTRAINT "order_discount_idempotency_receipts_application_fk" FOREIGN KEY ("tenant_id","application_id") REFERENCES "public"."order_discount_applications"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_discount_idempotency_receipts_tenant_key_unique" ON "order_discount_idempotency_receipts" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "order_discount_idempotency_receipts_application_idx" ON "order_discount_idempotency_receipts" USING btree ("application_id");--> statement-breakpoint
INSERT INTO "order_discount_idempotency_receipts" (
	"id",
	"tenant_id",
	"application_id",
	"idempotency_key",
	"intent_kind",
	"intent_value",
	"reason_snapshot",
	"created_at",
	"created_by"
)
SELECT
	"id",
	"tenant_id",
	"id",
	"idempotency_key",
	CASE
		WHEN "method_snapshot" = 'code' AND "code_snapshot" IS NOT NULL
			THEN 'code'
		ELSE 'discount_id'
	END,
	CASE
		WHEN "method_snapshot" = 'code' AND "code_snapshot" IS NOT NULL
			THEN lower(btrim("code_snapshot"))
		ELSE "discount_id"
	END,
	NULL,
	"applied_at",
	"created_by"
FROM "order_discount_applications"
WHERE "idempotency_key" IS NOT NULL
ON CONFLICT ("tenant_id", "idempotency_key") DO NOTHING;
