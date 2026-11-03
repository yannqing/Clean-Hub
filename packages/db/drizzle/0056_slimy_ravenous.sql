-- Tenant offboarding.
--
-- A tenant that leaves keeps its data for a retention window rather than
-- disappearing: the decision stays reversible, and an export can still be
-- taken after the fact. `purge_after` is when the cleanup job may physically
-- delete the data; until then the tenant is hidden from the normal list but
-- restorable by a super admin.
--
-- `deleted_by` completes the soft-delete pair the rest of the schema already
-- uses (`deleted_at` + `deleted_by`); tenants only had the timestamp.
ALTER TABLE "tenants" ADD COLUMN "deleted_by" varchar(26);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "offboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "offboarded_by" varchar(26);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "offboard_reason" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "purge_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_offboarded_by_users_id_fk" FOREIGN KEY ("offboarded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The purge job scans for elapsed retention windows.
CREATE INDEX "tenants_purge_after_idx" ON "tenants" USING btree ("purge_after");--> statement-breakpoint
-- An offboarded tenant must carry the whole decision: who, why, and until when.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_offboarding_complete_check" CHECK (
  ("offboarded_at" is null and "purge_after" is null and "offboard_reason" is null)
  or ("offboarded_at" is not null and "purge_after" is not null and "offboard_reason" is not null)
);
