ALTER TABLE "orders" ADD COLUMN "tax_label_snapshot" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_components_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "platform_tax_templates" ADD COLUMN "currency_code" varchar(3);--> statement-breakpoint
ALTER TABLE "platform_tax_templates" ADD COLUMN "tax_label" varchar(80);--> statement-breakpoint
ALTER TABLE "platform_tax_templates" ADD COLUMN "exemption_notes" text;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "tax_label" text;--> statement-breakpoint
ALTER TABLE "pos_channel_settings" ADD COLUMN "default_tax_components" jsonb;