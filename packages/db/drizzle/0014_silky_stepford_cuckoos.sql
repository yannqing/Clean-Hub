CREATE TYPE "public"."product_category_attribute_value_type" AS ENUM('text', 'single_select', 'multi_select');--> statement-breakpoint
CREATE TABLE "product_attribute_value_options" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"attribute_value_id" varchar(26) NOT NULL,
	"definition_id" varchar(26) NOT NULL,
	"option_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26)
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"product_id" varchar(26) NOT NULL,
	"definition_id" varchar(26) NOT NULL,
	"text_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_attr_values_text_not_blank_check" CHECK ("product_attribute_values"."text_value" is null or length(btrim("product_attribute_values"."text_value")) > 0)
);
--> statement-breakpoint
CREATE TABLE "product_category_attribute_definitions" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"category_id" varchar(26) NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"value_type" "product_category_attribute_value_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_cat_attr_defs_code_not_blank_check" CHECK (length(btrim("product_category_attribute_definitions"."code")) > 0),
	CONSTRAINT "product_cat_attr_defs_name_not_blank_check" CHECK (length(btrim("product_category_attribute_definitions"."name")) > 0),
	CONSTRAINT "product_cat_attr_defs_sort_order_check" CHECK ("product_category_attribute_definitions"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_category_attribute_options" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"definition_id" varchar(26) NOT NULL,
	"code" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_cat_attr_opts_code_not_blank_check" CHECK (length(btrim("product_category_attribute_options"."code")) > 0),
	CONSTRAINT "product_cat_attr_opts_label_not_blank_check" CHECK (length(btrim("product_category_attribute_options"."label")) > 0),
	CONSTRAINT "product_cat_attr_opts_sort_order_check" CHECK ("product_category_attribute_options"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_cat_attr_defs_tenant_id_unique" ON "product_category_attribute_definitions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_cat_attr_opts_tenant_definition_id_unique" ON "product_category_attribute_options" USING btree ("tenant_id","definition_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attr_values_tenant_definition_id_unique" ON "product_attribute_values" USING btree ("tenant_id","definition_id","id");--> statement-breakpoint
ALTER TABLE "product_attribute_value_options" ADD CONSTRAINT "product_attribute_value_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value_options" ADD CONSTRAINT "product_attribute_value_options_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value_options" ADD CONSTRAINT "product_attribute_value_options_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value_options" ADD CONSTRAINT "product_attr_value_opts_tenant_value_fk" FOREIGN KEY ("tenant_id","definition_id","attribute_value_id") REFERENCES "public"."product_attribute_values"("tenant_id","definition_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value_options" ADD CONSTRAINT "product_attr_value_opts_tenant_option_fk" FOREIGN KEY ("tenant_id","definition_id","option_id") REFERENCES "public"."product_category_attribute_options"("tenant_id","definition_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attr_values_tenant_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attr_values_tenant_definition_fk" FOREIGN KEY ("tenant_id","definition_id") REFERENCES "public"."product_category_attribute_definitions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_definitions" ADD CONSTRAINT "product_category_attribute_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_definitions" ADD CONSTRAINT "product_category_attribute_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_definitions" ADD CONSTRAINT "product_category_attribute_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_definitions" ADD CONSTRAINT "product_category_attribute_definitions_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_definitions" ADD CONSTRAINT "product_cat_attr_defs_tenant_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_options" ADD CONSTRAINT "product_category_attribute_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_options" ADD CONSTRAINT "product_category_attribute_options_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_options" ADD CONSTRAINT "product_category_attribute_options_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_options" ADD CONSTRAINT "product_category_attribute_options_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_attribute_options" ADD CONSTRAINT "product_cat_attr_opts_tenant_definition_fk" FOREIGN KEY ("tenant_id","definition_id") REFERENCES "public"."product_category_attribute_definitions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_attr_value_opts_active_unique" ON "product_attribute_value_options" USING btree ("tenant_id","attribute_value_id","definition_id","option_id") WHERE "product_attribute_value_options"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_attr_value_opts_value_idx" ON "product_attribute_value_options" USING btree ("tenant_id","attribute_value_id");--> statement-breakpoint
CREATE INDEX "product_attr_value_opts_option_idx" ON "product_attribute_value_options" USING btree ("tenant_id","option_id");--> statement-breakpoint
CREATE INDEX "product_attr_value_opts_deleted_at_idx" ON "product_attribute_value_options" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attr_values_tenant_id_unique" ON "product_attribute_values" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attr_values_active_definition_unique" ON "product_attribute_values" USING btree ("tenant_id","product_id","definition_id") WHERE "product_attribute_values"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_attr_values_product_idx" ON "product_attribute_values" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "product_attr_values_definition_idx" ON "product_attribute_values" USING btree ("tenant_id","definition_id");--> statement-breakpoint
CREATE INDEX "product_attr_values_deleted_at_idx" ON "product_attribute_values" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_cat_attr_defs_tenant_category_id_unique" ON "product_category_attribute_definitions" USING btree ("tenant_id","category_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_cat_attr_defs_active_code_unique" ON "product_category_attribute_definitions" USING btree ("tenant_id","category_id","code") WHERE "product_category_attribute_definitions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_cat_attr_defs_category_status_idx" ON "product_category_attribute_definitions" USING btree ("tenant_id","category_id","status");--> statement-breakpoint
CREATE INDEX "product_cat_attr_defs_deleted_at_idx" ON "product_category_attribute_definitions" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_cat_attr_opts_active_code_unique" ON "product_category_attribute_options" USING btree ("tenant_id","definition_id","code") WHERE "product_category_attribute_options"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_cat_attr_opts_definition_status_idx" ON "product_category_attribute_options" USING btree ("tenant_id","definition_id","status");--> statement-breakpoint
CREATE INDEX "product_cat_attr_opts_deleted_at_idx" ON "product_category_attribute_options" USING btree ("deleted_at");
