ALTER TABLE "branches" ADD COLUMN "payment_methods_enabled" "pos_payment_method"[] DEFAULT ARRAY['cash', 'app']::pos_payment_method[] NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "default_payment_method" "pos_payment_method" DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "cash_handling_mode" "pos_cash_handling_mode" DEFAULT 'shared_drawer' NOT NULL;--> statement-breakpoint

UPDATE "branches" AS branch
SET
  "payment_methods_enabled" = channel."default_payment_methods_enabled",
  "default_payment_method" = channel."default_payment_method",
  "cash_handling_mode" = CASE
    WHEN channel."default_cash_handling_mode" = 'assigned_drawer' THEN 'shared_drawer'::pos_cash_handling_mode
    ELSE channel."default_cash_handling_mode"
  END
FROM "pos_channel_settings" AS channel
WHERE channel."tenant_id" = branch."tenant_id";--> statement-breakpoint

ALTER TABLE "branches" ADD CONSTRAINT "branches_payment_methods_nonempty_check" CHECK (cardinality("branches"."payment_methods_enabled") > 0);--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_default_payment_method_enabled_check" CHECK ("branches"."default_payment_method" = any("branches"."payment_methods_enabled"));--> statement-breakpoint

ALTER TABLE "pos_terminal_settings" DROP CONSTRAINT "pos_terminal_settings_payment_methods_nonempty_check";--> statement-breakpoint
ALTER TABLE "pos_channel_settings" DROP CONSTRAINT "pos_channel_settings_payment_methods_nonempty_check";--> statement-breakpoint

ALTER TABLE "pos_cash_drawer_sessions" DROP CONSTRAINT "pos_cash_drawer_sessions_mode_check";--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" DROP CONSTRAINT "pos_cash_drawer_sessions_assignment_check";--> statement-breakpoint
DROP INDEX "pos_cash_drawer_sessions_shared_register_open_unique";--> statement-breakpoint
DROP INDEX "pos_cash_drawer_sessions_staff_register_open_unique";--> statement-breakpoint

ALTER TABLE "pos_terminal_settings" DROP COLUMN "payment_methods_enabled";--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" DROP COLUMN "default_payment_method";--> statement-breakpoint
ALTER TABLE "pos_terminal_settings" DROP COLUMN "cash_handling_mode";--> statement-breakpoint
ALTER TABLE "pos_channel_settings" DROP COLUMN "default_payment_methods_enabled";--> statement-breakpoint
ALTER TABLE "pos_channel_settings" DROP COLUMN "default_payment_method";--> statement-breakpoint
ALTER TABLE "pos_channel_settings" DROP COLUMN "default_cash_handling_mode";--> statement-breakpoint

ALTER TABLE "branches" ALTER COLUMN "cash_handling_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."pos_cash_handling_mode" RENAME TO "pos_cash_handling_mode_old";--> statement-breakpoint
CREATE TYPE "public"."pos_cash_handling_mode" AS ENUM('none', 'untracked', 'shared_drawer', 'cash_in_hand');--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "cash_handling_mode" SET DATA TYPE "public"."pos_cash_handling_mode" USING "cash_handling_mode"::text::"public"."pos_cash_handling_mode";--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ALTER COLUMN "handling_mode" SET DATA TYPE "public"."pos_cash_handling_mode" USING "handling_mode"::text::"public"."pos_cash_handling_mode";--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "cash_handling_mode" SET DEFAULT 'shared_drawer';--> statement-breakpoint
DROP TYPE "public"."pos_cash_handling_mode_old";--> statement-breakpoint

ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_mode_check" CHECK ("pos_cash_drawer_sessions"."handling_mode" not in ('none', 'untracked'));--> statement-breakpoint
ALTER TABLE "pos_cash_drawer_sessions" ADD CONSTRAINT "pos_cash_drawer_sessions_assignment_check" CHECK (("pos_cash_drawer_sessions"."handling_mode" = 'cash_in_hand' and "pos_cash_drawer_sessions"."assigned_staff_id" is not null)
        or ("pos_cash_drawer_sessions"."handling_mode" = 'shared_drawer' and "pos_cash_drawer_sessions"."assigned_staff_id" is null));--> statement-breakpoint
CREATE UNIQUE INDEX "pos_cash_drawer_sessions_shared_register_open_unique" ON "pos_cash_drawer_sessions" USING btree ("tenant_id","register_session_id") WHERE "pos_cash_drawer_sessions"."status" = 'open' and "pos_cash_drawer_sessions"."handling_mode" = 'shared_drawer';--> statement-breakpoint
CREATE UNIQUE INDEX "pos_cash_drawer_sessions_staff_register_open_unique" ON "pos_cash_drawer_sessions" USING btree ("tenant_id","register_session_id","assigned_staff_id") WHERE "pos_cash_drawer_sessions"."status" = 'open' and "pos_cash_drawer_sessions"."handling_mode" = 'cash_in_hand';
