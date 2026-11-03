ALTER TABLE "pos_channel_settings" ALTER COLUMN "cash_tracking_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ALTER COLUMN "require_opening_float" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ALTER COLUMN "require_closing_count" SET DEFAULT false;
--> statement-breakpoint
-- One-time rollout: cash/attendance management is optional for every tenant.
-- Preserve existing shifts, drawer sessions, payments and queued-sale references.
UPDATE "pos_channel_settings"
SET "cash_tracking_enabled" = false,
    "require_opening_float" = false,
    "require_closing_count" = false,
    "updated_at" = now(),
    "version" = "version" + 1
WHERE "cash_tracking_enabled" OR "require_opening_float" OR "require_closing_count";
