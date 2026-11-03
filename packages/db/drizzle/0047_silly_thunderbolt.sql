ALTER TABLE "services" DROP CONSTRAINT "services_applicable_item_types_check";--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_applicable_item_types_check" CHECK (cardinality("services"."applicable_item_types") > 0
        and "services"."applicable_item_types" <@ ARRAY['cloth', 'car', 'shoe', 'carpet']::text[]
        and ("services"."business_line"::text <> 'car_wash' or "services"."applicable_item_types" <@ ARRAY['car']::text[])
        and ("services"."business_line"::text <> 'laundry' or not ("services"."applicable_item_types" @> ARRAY['car']::text[])));