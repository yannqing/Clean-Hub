ALTER TABLE "hardware_configs" ADD COLUMN "terminal_id" varchar(26);--> statement-breakpoint

-- Legacy hardware was branch-bound. Attach each record to the oldest registered
-- terminal in that same tenant/branch so the new terminal relationship is valid.
WITH branch_terminals AS (
  SELECT DISTINCT ON (tenant_id, branch_id)
    id,
    tenant_id,
    branch_id
  FROM "pos_terminal_settings"
  ORDER BY tenant_id, branch_id, created_at ASC, id ASC
)
UPDATE "hardware_configs" AS hardware
SET "terminal_id" = terminal.id
FROM branch_terminals AS terminal
WHERE hardware.tenant_id = terminal.tenant_id
  AND hardware.branch_id = terminal.branch_id
  AND hardware.terminal_id IS NULL;--> statement-breakpoint

-- Do not silently migrate a peripheral without a real POS terminal owner.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "hardware_configs"
    WHERE "terminal_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate hardware without a POS terminal in its branch. Register a terminal and bind the affected hardware before retrying.';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "hardware_configs" ALTER COLUMN "terminal_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_configs" ADD CONSTRAINT "hardware_configs_terminal_id_pos_terminal_settings_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."pos_terminal_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "hardware_configs_branch_id_idx";--> statement-breakpoint
ALTER TABLE "hardware_configs" DROP CONSTRAINT "hardware_configs_branch_id_branches_id_fk";--> statement-breakpoint
ALTER TABLE "hardware_configs" DROP COLUMN "branch_id";--> statement-breakpoint
CREATE INDEX "hardware_configs_terminal_id_idx" ON "hardware_configs" USING btree ("terminal_id");
