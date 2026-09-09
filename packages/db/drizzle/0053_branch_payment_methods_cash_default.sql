ALTER TABLE "branches" ALTER COLUMN "payment_methods_enabled" SET DEFAULT ARRAY['cash']::pos_payment_method[];--> statement-breakpoint

UPDATE "branches" AS branch
SET
  "payment_methods_enabled" = CASE
    WHEN cardinality(
      array_remove(branch."payment_methods_enabled", 'app'::pos_payment_method)
    ) = 0
      THEN ARRAY['cash']::pos_payment_method[]
    ELSE array_remove(
      branch."payment_methods_enabled",
      'app'::pos_payment_method
    )
  END,
  "default_payment_method" = CASE
    WHEN branch."default_payment_method" = 'app' THEN 'cash'::pos_payment_method
    ELSE branch."default_payment_method"
  END
WHERE 'app' = ANY (branch."payment_methods_enabled")
  AND NOT EXISTS (
    SELECT 1
    FROM "tenant_payment_integrations" AS integration
    WHERE integration."tenant_id" = branch."tenant_id"
      AND integration."verification_status" = 'verified'
      AND integration."pos_enabled" = true
  );
