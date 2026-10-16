CREATE TYPE "public"."hardware_provisioning_mode" AS ENUM('manual', 'built_in');--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD COLUMN "provisioning_mode" "hardware_provisioning_mode" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD COLUMN "hardware_key" varchar(256);--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_configs_terminal_hardware_key_unique" ON "hardware_configs" USING btree ("tenant_id","terminal_id","hardware_key");
