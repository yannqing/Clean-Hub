ALTER TABLE "prices" ADD COLUMN "compare_at_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "cost_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "code" varchar(64);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "short_name" varchar(80);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "turnaround_minutes" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "services_active_code_unique" ON "services" USING btree ("tenant_id","code") WHERE "services"."deleted_at" is null and "services"."code" is not null;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_compare_at_amount_check" CHECK ("prices"."compare_at_amount" is null or "prices"."compare_at_amount" > 0);--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_cost_amount_check" CHECK ("prices"."cost_amount" is null or "prices"."cost_amount" > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_code_not_blank_check" CHECK ("services"."code" is null or length(btrim("services"."code")) > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_turnaround_minutes_check" CHECK ("services"."turnaround_minutes" is null or ("services"."turnaround_minutes" >= 1 and "services"."turnaround_minutes" <= 525600));