ALTER TABLE "pos_z_reports" ADD COLUMN "unsettled_payment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD COLUMN "unsettled_payment_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD COLUMN "unsettled_refund_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_z_reports" ADD COLUMN "unsettled_refund_amount" numeric(12, 2) DEFAULT '0' NOT NULL;