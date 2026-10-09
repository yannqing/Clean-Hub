CREATE TYPE "public"."order_item_kind" AS ENUM('service', 'product', 'subscription', 'delivery_fee');--> statement-breakpoint
CREATE TYPE "public"."sales_return_disposition" AS ENUM('restock', 'damaged', 'discarded', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."sales_return_item_condition" AS ENUM('unopened', 'good', 'damaged', 'defective', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."sales_return_status" AS ENUM('draft', 'approved', 'received', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('opening', 'receipt', 'sale', 'sale_return', 'adjustment_in', 'adjustment_out', 'damage', 'loss', 'transfer_in', 'transfer_out', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."inventory_reservation_status" AS ENUM('active', 'consumed', 'released', 'expired');--> statement-breakpoint
CREATE TABLE "branch_product_settings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26) NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"allow_negative_stock" boolean DEFAULT false NOT NULL,
	"allow_offline_sale" boolean DEFAULT false NOT NULL,
	"reorder_point" numeric(14, 3) DEFAULT '0' NOT NULL,
	"offline_stock_buffer" numeric(14, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "branch_product_settings_reorder_point_check" CHECK ("branch_product_settings"."reorder_point" >= 0),
	CONSTRAINT "branch_product_settings_offline_buffer_check" CHECK ("branch_product_settings"."offline_stock_buffer" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"parent_id" varchar(26),
	"name" varchar(120) NOT NULL,
	"code" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_categories_parent_not_self_check" CHECK ("product_categories"."parent_id" is null or "product_categories"."parent_id" <> "product_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"product_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26),
	"media_object_id" varchar(26) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26)
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26),
	"product_sku_id" varchar(26) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_prices_amount_nonnegative_check" CHECK ("product_prices"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_skus" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"product_id" varchar(26) NOT NULL,
	"sku_code" varchar(80) NOT NULL,
	"barcode" varchar(80),
	"variant_name" varchar(160),
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unit_of_measure" varchar(32) DEFAULT 'piece' NOT NULL,
	"units_per_sale" numeric(14, 3) DEFAULT '1' NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"reference_cost_amount" numeric(12, 2),
	"cost_currency" varchar(3),
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_skus_units_per_sale_positive_check" CHECK ("product_skus"."units_per_sale" > 0),
	CONSTRAINT "product_skus_reference_cost_check" CHECK (("product_skus"."reference_cost_amount" is null and "product_skus"."cost_currency" is null)
        or ("product_skus"."reference_cost_amount" >= 0 and "product_skus"."cost_currency" is not null))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"category_id" varchar(26),
	"name" varchar(200) NOT NULL,
	"brand" varchar(120),
	"description" text,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_return_items" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"sales_return_id" varchar(26) NOT NULL,
	"order_item_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"condition" "sales_return_item_condition" DEFAULT 'unknown' NOT NULL,
	"disposition" "sales_return_disposition" NOT NULL,
	"refund_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	CONSTRAINT "sales_return_items_quantity_positive_check" CHECK ("sales_return_items"."quantity" > 0),
	CONSTRAINT "sales_return_items_refund_amount_nonnegative_check" CHECK ("sales_return_items"."refund_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_returns" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"customer_id" varchar(26),
	"status" "sales_return_status" DEFAULT 'draft' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"refund_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"received_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_by" varchar(26),
	"approved_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sales_returns_refund_amount_nonnegative_check" CHECK ("sales_returns"."refund_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26) NOT NULL,
	"on_hand_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"average_unit_cost" numeric(14, 4),
	"currency" varchar(3),
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_balances_reserved_nonnegative_check" CHECK ("inventory_balances"."reserved_quantity" >= 0),
	CONSTRAINT "inventory_balances_average_cost_check" CHECK (("inventory_balances"."average_unit_cost" is null and "inventory_balances"."currency" is null)
        or ("inventory_balances"."average_unit_cost" >= 0 and "inventory_balances"."currency" is not null))
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26) NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"quantity_delta" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 4),
	"currency" varchar(3),
	"reference_type" varchar(40) NOT NULL,
	"reference_id" varchar(26),
	"order_item_id" varchar(26),
	"reversal_of_movement_id" varchar(26),
	"terminal_id" varchar(26),
	"device_id" varchar(128),
	"idempotency_key" varchar(120) NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	CONSTRAINT "inventory_movements_quantity_nonzero_check" CHECK ("inventory_movements"."quantity_delta" <> 0),
	CONSTRAINT "inventory_movements_unit_cost_check" CHECK (("inventory_movements"."unit_cost" is null and "inventory_movements"."currency" is null)
        or ("inventory_movements"."unit_cost" >= 0 and "inventory_movements"."currency" is not null)),
	CONSTRAINT "inventory_movements_reversal_not_self_check" CHECK ("inventory_movements"."reversal_of_movement_id" is null or "inventory_movements"."reversal_of_movement_id" <> "inventory_movements"."id")
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"product_sku_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"order_item_id" varchar(26) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"status" "inventory_reservation_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26) NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_reservations_quantity_positive_check" CHECK ("inventory_reservations"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_kind" "order_item_kind" DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_sku_id" varchar(26);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_price_id" varchar(26);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sku_snapshot" varchar(80);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "barcode_snapshot" varchar(80);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_name_snapshot" varchar(160);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_of_measure_snapshot" varchar(32);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_amount" numeric(14, 4);--> statement-breakpoint
UPDATE "order_items"
SET "item_kind" = 'subscription'
WHERE "source_type" = 'subscription';--> statement-breakpoint
UPDATE "order_items"
SET "item_kind" = 'delivery_fee'
WHERE "source_type" = 'delivery_fee';--> statement-breakpoint
UPDATE "order_items" AS "oi"
SET "service_id" = "ti"."service_id"
FROM "ticket_items" AS "ti"
WHERE "oi"."source_type" = 'ticket_item'
	AND "oi"."source_id" = "ti"."id"
	AND "oi"."tenant_id" = "ti"."tenant_id"
	AND "oi"."ticket_id" = "ti"."ticket_id"
	AND "oi"."service_id" IS NULL
	AND "ti"."service_id" IS NOT NULL;--> statement-breakpoint
UPDATE "order_items" AS "oi"
SET "service_id" = "s"."id"
FROM "services" AS "s"
WHERE "oi"."source_type" = 'product'
	AND "oi"."source_id" = "s"."id"
	AND "oi"."tenant_id" = "s"."tenant_id"
	AND "oi"."service_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_id_id_unique" ON "branches" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_id_id_unique" ON "orders" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_tenant_id_id_unique" ON "order_items" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_tenant_id_id_unique" ON "product_categories" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_id_id_unique" ON "products" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_tenant_id_id_unique" ON "product_skus" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_tenant_product_id_id_unique" ON "product_skus" USING btree ("tenant_id","product_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_tenant_sku_id_id_unique" ON "product_prices" USING btree ("tenant_id","product_sku_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_returns_tenant_id_id_unique" ON "sales_returns" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_tenant_id_id_unique" ON "inventory_movements" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "branch_product_settings" ADD CONSTRAINT "branch_product_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product_settings" ADD CONSTRAINT "branch_product_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product_settings" ADD CONSTRAINT "branch_product_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product_settings" ADD CONSTRAINT "branch_product_settings_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product_settings" ADD CONSTRAINT "branch_product_settings_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_parent_fk" FOREIGN KEY ("tenant_id","parent_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_object_id_media_objects_id_fk" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_product_sku_fk" FOREIGN KEY ("tenant_id","product_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_tenant_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_tenant_return_fk" FOREIGN KEY ("tenant_id","sales_return_id") REFERENCES "public"."sales_returns"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_tenant_order_item_fk" FOREIGN KEY ("tenant_id","order_item_id") REFERENCES "public"."order_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_order_fk" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_order_item_fk" FOREIGN KEY ("tenant_id","order_item_id") REFERENCES "public"."order_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_reversal_fk" FOREIGN KEY ("tenant_id","reversal_of_movement_id") REFERENCES "public"."inventory_movements"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_order_fk" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_order_item_fk" FOREIGN KEY ("tenant_id","order_item_id") REFERENCES "public"."order_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_product_settings_scope_unique" ON "branch_product_settings" USING btree ("tenant_id","branch_id","product_sku_id");--> statement-breakpoint
CREATE INDEX "branch_product_settings_branch_available_idx" ON "branch_product_settings" USING btree ("tenant_id","branch_id","is_available");--> statement-breakpoint
CREATE INDEX "branch_product_settings_product_sku_id_idx" ON "branch_product_settings" USING btree ("product_sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_tenant_code_unique" ON "product_categories" USING btree ("tenant_id","code") WHERE "product_categories"."deleted_at" is null and "product_categories"."code" is not null;--> statement-breakpoint
CREATE INDEX "product_categories_tenant_status_idx" ON "product_categories" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_categories_deleted_at_idx" ON "product_categories" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_product_object_unique" ON "product_media" USING btree ("tenant_id","product_id","media_object_id") WHERE "product_media"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_product_primary_unique" ON "product_media" USING btree ("tenant_id","product_id") WHERE "product_media"."deleted_at" is null and "product_media"."product_sku_id" is null and "product_media"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_sku_primary_unique" ON "product_media" USING btree ("tenant_id","product_sku_id") WHERE "product_media"."deleted_at" is null and "product_media"."product_sku_id" is not null and "product_media"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "product_media_media_object_id_idx" ON "product_media" USING btree ("media_object_id");--> statement-breakpoint
CREATE INDEX "product_media_deleted_at_idx" ON "product_media" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_tenant_default_unique" ON "product_prices" USING btree ("tenant_id","product_sku_id","currency") WHERE "product_prices"."branch_id" is null and "product_prices"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_branch_unique" ON "product_prices" USING btree ("tenant_id","branch_id","product_sku_id","currency") WHERE "product_prices"."branch_id" is not null and "product_prices"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_prices_tenant_status_idx" ON "product_prices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "product_prices_product_sku_id_idx" ON "product_prices" USING btree ("product_sku_id");--> statement-breakpoint
CREATE INDEX "product_prices_deleted_at_idx" ON "product_prices" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_tenant_sku_code_unique" ON "product_skus" USING btree ("tenant_id","sku_code") WHERE "product_skus"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_tenant_barcode_unique" ON "product_skus" USING btree ("tenant_id","barcode") WHERE "product_skus"."deleted_at" is null and "product_skus"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "product_skus_tenant_status_idx" ON "product_skus" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "product_skus_product_id_idx" ON "product_skus" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_skus_deleted_at_idx" ON "product_skus" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "products_tenant_status_idx" ON "products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "products_tenant_name_idx" ON "products" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_return_items_return_order_item_unique" ON "sales_return_items" USING btree ("sales_return_id","order_item_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_product_sku_id_idx" ON "sales_return_items" USING btree ("product_sku_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_order_item_id_idx" ON "sales_return_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "sales_returns_tenant_branch_status_idx" ON "sales_returns" USING btree ("tenant_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "sales_returns_order_id_idx" ON "sales_returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_scope_unique" ON "inventory_balances" USING btree ("tenant_id","branch_id","product_sku_id");--> statement-breakpoint
CREATE INDEX "inventory_balances_branch_idx" ON "inventory_balances" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE INDEX "inventory_balances_product_sku_id_idx" ON "inventory_balances" USING btree ("product_sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_tenant_idempotency_unique" ON "inventory_movements" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "inventory_movements_branch_sku_occurred_idx" ON "inventory_movements" USING btree ("tenant_id","branch_id","product_sku_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("tenant_id","reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_item_id_idx" ON "inventory_movements" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_occurred_at_idx" ON "inventory_movements" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_order_item_unique" ON "inventory_reservations" USING btree ("tenant_id","order_item_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_branch_status_idx" ON "inventory_reservations" USING btree ("tenant_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_sku_status_idx" ON "inventory_reservations" USING btree ("tenant_id","product_sku_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_expires_at_idx" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_product_sku_fk" FOREIGN KEY ("tenant_id","product_sku_id") REFERENCES "public"."product_skus"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_product_price_fk" FOREIGN KEY ("tenant_id","product_sku_id","product_price_id") REFERENCES "public"."product_prices"("tenant_id","product_sku_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_sku_id_idx" ON "order_items" USING btree ("product_sku_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_reference_check" CHECK ((
        "order_items"."item_kind" = 'product'
        and "order_items"."product_sku_id" is not null
        and "order_items"."service_id" is null
        and "order_items"."ticket_id" is null
      ) or (
        "order_items"."item_kind" <> 'product'
        and "order_items"."product_sku_id" is null
        and "order_items"."product_price_id" is null
      ));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_cost_nonnegative_check" CHECK ("order_items"."unit_cost_amount" is null or "order_items"."unit_cost_amount" >= 0);
