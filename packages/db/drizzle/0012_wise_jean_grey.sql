ALTER TYPE "public"."media_object_status" ADD VALUE 'deleting';--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "cleanup_claim_token" varchar(26);--> statement-breakpoint
ALTER TABLE "media_objects" ADD COLUMN "cleanup_claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "media_objects_cleanup_claim_idx" ON "media_objects" USING btree ("status","cleanup_claimed_at");--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_cleanup_claim_pair_check" CHECK (("media_objects"."cleanup_claim_token" is null and "media_objects"."cleanup_claimed_at" is null)
        or ("media_objects"."cleanup_claim_token" is not null and "media_objects"."cleanup_claimed_at" is not null));