CREATE TYPE "public"."discount_application_status" AS ENUM('applied', 'voided');--> statement-breakpoint
CREATE TYPE "public"."discount_country_scope" AS ENUM('all', 'selected');--> statement-breakpoint
CREATE TYPE "public"."discount_eligibility" AS ENUM('all_customers', 'specific_customers');--> statement-breakpoint
CREATE TYPE "public"."discount_method" AS ENUM('code', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."discount_minimum_requirement" AS ENUM('none', 'minimum_amount', 'minimum_quantity');--> statement-breakpoint
CREATE TYPE "public"."discount_purchase_requirement" AS ENUM('minimum_amount', 'minimum_quantity');--> statement-breakpoint
CREATE TYPE "public"."discount_target_role" AS ENUM('applies_to', 'customer_buys', 'customer_gets');--> statement-breakpoint
CREATE TYPE "public"."discount_target_type" AS ENUM('product', 'product_category', 'service', 'service_category');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('amount_off_items', 'buy_x_get_y', 'amount_off_order', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."discount_value_type" AS ENUM('percentage', 'fixed_amount', 'free');--> statement-breakpoint
CREATE TABLE "discount_branches" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"discount_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26)
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"discount_id" varchar(26) NOT NULL,
	"code" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	CONSTRAINT "discount_codes_code_not_blank_check" CHECK (length(btrim("discount_codes"."code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "discount_customers" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"discount_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26)
);
--> statement-breakpoint
CREATE TABLE "discount_targets" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"discount_id" varchar(26) NOT NULL,
	"role" "discount_target_role" NOT NULL,
	"target_type" "discount_target_type" NOT NULL,
	"product_id" varchar(26),
	"product_category_id" varchar(26),
	"service_id" varchar(26),
	"service_category_id" varchar(26),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	CONSTRAINT "discount_targets_reference_check" CHECK ((
        "discount_targets"."target_type" = 'product'
        and "discount_targets"."product_id" is not null
        and "discount_targets"."product_category_id" is null
        and "discount_targets"."service_id" is null
        and "discount_targets"."service_category_id" is null
      ) or (
        "discount_targets"."target_type" = 'product_category'
        and "discount_targets"."product_id" is null
        and "discount_targets"."product_category_id" is not null
        and "discount_targets"."service_id" is null
        and "discount_targets"."service_category_id" is null
      ) or (
        "discount_targets"."target_type" = 'service'
        and "discount_targets"."product_id" is null
        and "discount_targets"."product_category_id" is null
        and "discount_targets"."service_id" is not null
        and "discount_targets"."service_category_id" is null
      ) or (
        "discount_targets"."target_type" = 'service_category'
        and "discount_targets"."product_id" is null
        and "discount_targets"."product_category_id" is null
        and "discount_targets"."service_id" is null
        and "discount_targets"."service_category_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"title" varchar(200) NOT NULL,
	"method" "discount_method" NOT NULL,
	"type" "discount_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"value_type" "discount_value_type",
	"value_amount" numeric(14, 2),
	"currency" varchar(3),
	"eligibility" "discount_eligibility" DEFAULT 'all_customers' NOT NULL,
	"minimum_requirement" "discount_minimum_requirement" DEFAULT 'none' NOT NULL,
	"minimum_purchase_amount" numeric(14, 2),
	"minimum_quantity" numeric(14, 3),
	"usage_limit" integer,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"combines_with_item_discounts" boolean DEFAULT false NOT NULL,
	"combines_with_order_discounts" boolean DEFAULT false NOT NULL,
	"combines_with_shipping_discounts" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"all_branches" boolean DEFAULT true NOT NULL,
	"pos_enabled" boolean DEFAULT true NOT NULL,
	"customer_mobile_enabled" boolean DEFAULT false NOT NULL,
	"delivery_enabled" boolean DEFAULT false NOT NULL,
	"buy_requirement_type" "discount_purchase_requirement",
	"buy_requirement_value" numeric(14, 3),
	"get_quantity" numeric(14, 3),
	"max_uses_per_order" integer,
	"country_scope" "discount_country_scope" DEFAULT 'all' NOT NULL,
	"country_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maximum_shipping_price" numeric(14, 2),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "discounts_title_not_blank_check" CHECK (length(btrim("discounts"."title")) > 0),
	CONSTRAINT "discounts_value_configuration_check" CHECK ((
        "discounts"."type" in ('amount_off_items', 'amount_off_order')
        and "discounts"."value_type" in ('percentage', 'fixed_amount')
        and "discounts"."value_amount" > 0
      ) or (
        "discounts"."type" = 'buy_x_get_y'
        and "discounts"."value_type" in ('percentage', 'fixed_amount', 'free')
        and (
          ("discounts"."value_type" = 'free' and "discounts"."value_amount" is null)
          or ("discounts"."value_type" <> 'free' and "discounts"."value_amount" > 0)
        )
      ) or (
        "discounts"."type" = 'free_shipping'
        and "discounts"."value_type" = 'free'
        and "discounts"."value_amount" is null
      )),
	CONSTRAINT "discounts_percentage_value_check" CHECK ("discounts"."value_type" <> 'percentage'
        or "discounts"."value_amount" between 0.01 and 100),
	CONSTRAINT "discounts_currency_configuration_check" CHECK ((
        "discounts"."value_type" = 'fixed_amount'
        or "discounts"."minimum_requirement" = 'minimum_amount'
        or "discounts"."buy_requirement_type" = 'minimum_amount'
        or "discounts"."maximum_shipping_price" is not null
      ) = ("discounts"."currency" is not null)),
	CONSTRAINT "discounts_minimum_configuration_check" CHECK ((
        "discounts"."minimum_requirement" = 'none'
        and "discounts"."minimum_purchase_amount" is null
        and "discounts"."minimum_quantity" is null
      ) or (
        "discounts"."minimum_requirement" = 'minimum_amount'
        and "discounts"."minimum_purchase_amount" > 0
        and "discounts"."minimum_quantity" is null
      ) or (
        "discounts"."minimum_requirement" = 'minimum_quantity'
        and "discounts"."minimum_quantity" > 0
        and "discounts"."minimum_purchase_amount" is null
      )),
	CONSTRAINT "discounts_buy_configuration_check" CHECK ((
        "discounts"."type" <> 'buy_x_get_y'
        and "discounts"."buy_requirement_type" is null
        and "discounts"."buy_requirement_value" is null
        and "discounts"."get_quantity" is null
        and "discounts"."max_uses_per_order" is null
      ) or (
        "discounts"."type" = 'buy_x_get_y'
        and "discounts"."buy_requirement_type" is not null
        and "discounts"."buy_requirement_value" > 0
        and "discounts"."get_quantity" > 0
        and ("discounts"."max_uses_per_order" is null or "discounts"."max_uses_per_order" > 0)
      )),
	CONSTRAINT "discounts_shipping_configuration_check" CHECK ((
        "discounts"."type" = 'free_shipping'
        and ("discounts"."maximum_shipping_price" is null or "discounts"."maximum_shipping_price" > 0)
      ) or (
        "discounts"."type" <> 'free_shipping'
        and "discounts"."country_scope" = 'all'
        and jsonb_array_length("discounts"."country_codes") = 0
        and "discounts"."maximum_shipping_price" is null
      )),
	CONSTRAINT "discounts_country_codes_array_check" CHECK (jsonb_typeof("discounts"."country_codes") = 'array'
        and (
          "discounts"."country_scope" = 'all'
          or jsonb_array_length("discounts"."country_codes") > 0
        )),
	CONSTRAINT "discounts_tags_array_check" CHECK (jsonb_typeof("discounts"."tags") = 'array'),
	CONSTRAINT "discounts_usage_limit_check" CHECK ("discounts"."usage_limit" is null or "discounts"."usage_limit" > 0),
	CONSTRAINT "discounts_date_range_check" CHECK ("discounts"."ends_at" is null or "discounts"."ends_at" > "discounts"."starts_at"),
	CONSTRAINT "discounts_version_check" CHECK ("discounts"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "order_discount_allocations" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"application_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"order_item_id" varchar(26) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_discount_allocations_amount_check" CHECK ("order_discount_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_discount_applications" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"customer_id" varchar(26) NOT NULL,
	"discount_id" varchar(26) NOT NULL,
	"discount_code_id" varchar(26),
	"title_snapshot" varchar(200) NOT NULL,
	"code_snapshot" varchar(100),
	"method_snapshot" "discount_method" NOT NULL,
	"type_snapshot" "discount_type" NOT NULL,
	"value_type_snapshot" "discount_value_type",
	"value_amount_snapshot" numeric(14, 2),
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "discount_application_status" DEFAULT 'applied' NOT NULL,
	"idempotency_key" varchar(120),
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_by" varchar(26),
	"voided_by" varchar(26),
	CONSTRAINT "order_discount_applications_amount_check" CHECK ("order_discount_applications"."amount" > 0),
	CONSTRAINT "order_discount_applications_status_check" CHECK ((
        "order_discount_applications"."status" = 'applied'
        and "order_discount_applications"."voided_at" is null
        and "order_discount_applications"."void_reason" is null
        and "order_discount_applications"."voided_by" is null
      ) or (
        "order_discount_applications"."status" = 'voided'
        and "order_discount_applications"."voided_at" is not null
        and "order_discount_applications"."void_reason" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "orders"
SET "subtotal_amount" = "total_amount",
	"discount_amount" = 0;--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_tenant_id_id_unique" ON "discounts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_discount_applications_tenant_id_id_unique" ON "order_discount_applications" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "discount_branches" ADD CONSTRAINT "discount_branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_branches" ADD CONSTRAINT "discount_branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_branches" ADD CONSTRAINT "discount_branches_tenant_discount_fk" FOREIGN KEY ("tenant_id","discount_id") REFERENCES "public"."discounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_branches" ADD CONSTRAINT "discount_branches_tenant_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "public"."branches"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_tenant_discount_fk" FOREIGN KEY ("tenant_id","discount_id") REFERENCES "public"."discounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_tenant_discount_fk" FOREIGN KEY ("tenant_id","discount_id") REFERENCES "public"."discounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_discount_fk" FOREIGN KEY ("tenant_id","discount_id") REFERENCES "public"."discounts"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_product_category_fk" FOREIGN KEY ("tenant_id","product_category_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_service_fk" FOREIGN KEY ("tenant_id","service_id") REFERENCES "public"."services"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_tenant_service_category_fk" FOREIGN KEY ("tenant_id","service_category_id") REFERENCES "public"."service_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_allocations" ADD CONSTRAINT "order_discount_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_allocations" ADD CONSTRAINT "order_discount_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_allocations" ADD CONSTRAINT "order_discount_allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_allocations" ADD CONSTRAINT "order_discount_allocations_tenant_application_fk" FOREIGN KEY ("tenant_id","application_id") REFERENCES "public"."order_discount_applications"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_branches_scope_unique" ON "discount_branches" USING btree ("tenant_id","discount_id","branch_id");--> statement-breakpoint
CREATE INDEX "discount_branches_branch_id_idx" ON "discount_branches" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_tenant_id_id_unique" ON "discount_codes" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_tenant_code_unique" ON "discount_codes" USING btree ("tenant_id",lower("code")) WHERE "discount_codes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_discount_active_unique" ON "discount_codes" USING btree ("tenant_id","discount_id") WHERE "discount_codes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "discount_codes_discount_id_idx" ON "discount_codes" USING btree ("discount_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_customers_scope_unique" ON "discount_customers" USING btree ("tenant_id","discount_id","customer_id");--> statement-breakpoint
CREATE INDEX "discount_customers_customer_id_idx" ON "discount_customers" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_targets_product_unique" ON "discount_targets" USING btree ("tenant_id","discount_id","role","product_id") WHERE "discount_targets"."target_type" = 'product';--> statement-breakpoint
CREATE UNIQUE INDEX "discount_targets_product_category_unique" ON "discount_targets" USING btree ("tenant_id","discount_id","role","product_category_id") WHERE "discount_targets"."target_type" = 'product_category';--> statement-breakpoint
CREATE UNIQUE INDEX "discount_targets_service_unique" ON "discount_targets" USING btree ("tenant_id","discount_id","role","service_id") WHERE "discount_targets"."target_type" = 'service';--> statement-breakpoint
CREATE UNIQUE INDEX "discount_targets_service_category_unique" ON "discount_targets" USING btree ("tenant_id","discount_id","role","service_category_id") WHERE "discount_targets"."target_type" = 'service_category';--> statement-breakpoint
CREATE INDEX "discount_targets_discount_id_idx" ON "discount_targets" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discounts_tenant_type_idx" ON "discounts" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "discounts_tenant_method_idx" ON "discounts" USING btree ("tenant_id","method");--> statement-breakpoint
CREATE INDEX "discounts_tenant_enabled_dates_idx" ON "discounts" USING btree ("tenant_id","enabled","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "discounts_deleted_at_idx" ON "discounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_discount_allocations_application_item_unique" ON "order_discount_allocations" USING btree ("tenant_id","application_id","order_item_id");--> statement-breakpoint
CREATE INDEX "order_discount_allocations_order_id_idx" ON "order_discount_allocations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_discount_allocations_order_item_id_idx" ON "order_discount_allocations" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_discount_applications_active_unique" ON "order_discount_applications" USING btree ("tenant_id","order_id","discount_id") WHERE "order_discount_applications"."status" = 'applied';--> statement-breakpoint
CREATE UNIQUE INDEX "order_discount_applications_idempotency_unique" ON "order_discount_applications" USING btree ("tenant_id","idempotency_key") WHERE "order_discount_applications"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "order_discount_applications_order_id_idx" ON "order_discount_applications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_discount_applications_discount_id_idx" ON "order_discount_applications" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "order_discount_applications_customer_id_idx" ON "order_discount_applications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_discount_applications_applied_at_idx" ON "order_discount_applications" USING btree ("applied_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_check" CHECK ("orders"."subtotal_amount" >= 0
        and "orders"."discount_amount" >= 0
        and "orders"."discount_amount" <= "orders"."subtotal_amount"
        and "orders"."total_amount" = "orders"."subtotal_amount" - "orders"."discount_amount");
