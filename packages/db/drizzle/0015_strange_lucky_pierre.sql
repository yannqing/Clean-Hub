CREATE TYPE "public"."service_label_rule" AS ENUM('none', 'per_item', 'per_order_item', 'per_bag');--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"name" varchar(120) NOT NULL,
	"business_line" "business_line" NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "catalog_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_by" varchar(26),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "service_categories_name_not_blank_check" CHECK (length(btrim("service_categories"."name")) > 0),
	CONSTRAINT "service_categories_sort_order_check" CHECK ("service_categories"."sort_order" >= 0)
);
--> statement-breakpoint
DROP INDEX "services_tenant_id_idx";--> statement-breakpoint
DROP INDEX "services_business_line_idx";--> statement-breakpoint
DROP INDEX "services_status_idx";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "label_rule" "service_label_rule" DEFAULT 'per_order_item' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_tenant_id_id_unique" ON "service_categories" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_tenant_line_id_unique" ON "service_categories" USING btree ("tenant_id","business_line","id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_active_name_unique" ON "service_categories" USING btree ("tenant_id","business_line","name") WHERE "service_categories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "service_categories_tenant_line_status_idx" ON "service_categories" USING btree ("tenant_id","business_line","status");--> statement-breakpoint
CREATE INDEX "service_categories_deleted_at_idx" ON "service_categories" USING btree ("deleted_at");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "services"
		WHERE "category_id" IS NOT NULL
		) THEN
			RAISE EXCEPTION
				'Cannot migrate services.category_id: non-null legacy category IDs exist. Add an explicit legacy-to-service_categories mapping to this migration before applying it.';
		END IF;
END
$$;--> statement-breakpoint
WITH "service_scopes" AS (
	SELECT DISTINCT "tenant_id", "business_line"
	FROM "services"
),
"uncategorized_categories" AS (
	SELECT
		"tenant_id",
		"business_line",
		left("tenant_id", 10) || (
			SELECT string_agg(
				substring(
					'0123456789ABCDEFGHJKMNPQRSTVWXYZ'
					FROM (get_byte(decode(md5(
						'service-category:uncategorized:' || "service_scopes"."tenant_id" || ':' || "service_scopes"."business_line"::text
					), 'hex'), "byte_index") % 32) + 1
					FOR 1
				),
				''
				ORDER BY "byte_index"
			)
			FROM generate_series(0, 15) AS "bytes"("byte_index")
		) AS "id"
	FROM "service_scopes"
)
INSERT INTO "service_categories" (
	"id",
	"tenant_id",
	"name",
	"business_line",
	"description",
	"sort_order",
	"status"
)
SELECT
	"id",
	"tenant_id",
	'未分类',
	"business_line",
	'迁移期间为既有服务自动创建的默认分类',
	9999,
	'active'
FROM "uncategorized_categories"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
WITH "service_scopes" AS (
	SELECT DISTINCT "tenant_id", "business_line"
	FROM "services"
),
"uncategorized_categories" AS (
	SELECT
		"tenant_id",
		"business_line",
		left("tenant_id", 10) || (
			SELECT string_agg(
				substring(
					'0123456789ABCDEFGHJKMNPQRSTVWXYZ'
					FROM (get_byte(decode(md5(
						'service-category:uncategorized:' || "service_scopes"."tenant_id" || ':' || "service_scopes"."business_line"::text
					), 'hex'), "byte_index") % 32) + 1
					FOR 1
				),
				''
				ORDER BY "byte_index"
			)
			FROM generate_series(0, 15) AS "bytes"("byte_index")
		) AS "id"
	FROM "service_scopes"
)
UPDATE "services" AS "service"
SET "category_id" = "category"."id"
FROM "uncategorized_categories" AS "category"
WHERE "service"."tenant_id" = "category"."tenant_id"
	AND "service"."business_line" = "category"."business_line"
	AND "service"."category_id" IS NULL;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_line_category_fk" FOREIGN KEY ("tenant_id","business_line","category_id") REFERENCES "public"."service_categories"("tenant_id","business_line","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "services_tenant_id_id_unique" ON "services" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "services_tenant_line_status_idx" ON "services" USING btree ("tenant_id","business_line","status");--> statement-breakpoint
CREATE INDEX "services_tenant_category_idx" ON "services" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "services_tenant_display_order_idx" ON "services" USING btree ("tenant_id","display_order");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_name_not_blank_check" CHECK (length(btrim("services"."name")) > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_display_order_check" CHECK ("services"."display_order" >= 0);
