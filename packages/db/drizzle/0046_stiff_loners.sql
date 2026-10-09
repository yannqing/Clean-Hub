ALTER TABLE "services" ADD COLUMN "applicable_item_types" text[];--> statement-breakpoint
UPDATE "services"
SET "applicable_item_types" = CASE
  WHEN "business_line" = 'car_wash' THEN ARRAY['car']::text[]
  WHEN "business_line" = 'laundry' THEN ARRAY['cloth', 'shoe', 'carpet']::text[]
  ELSE ARRAY['cloth', 'car', 'shoe', 'carpet']::text[]
END;--> statement-breakpoint
ALTER TABLE "services"
  ALTER COLUMN "applicable_item_types" SET DEFAULT ARRAY['cloth', 'shoe', 'carpet']::text[],
  ALTER COLUMN "applicable_item_types" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_applicable_item_types_check" CHECK (cardinality("services"."applicable_item_types") > 0 and "services"."applicable_item_types" <@ ARRAY['cloth', 'car', 'shoe', 'carpet']::text[]);
