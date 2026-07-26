ALTER TABLE "media_objects" DROP CONSTRAINT "media_objects_cleanup_claim_pair_check";--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_cleanup_claim_pair_check" CHECK ((
        "media_objects"."status" = 'deleting'
        and "media_objects"."cleanup_claim_token" is not null
        and "media_objects"."cleanup_claimed_at" is not null
      ) or (
        "media_objects"."status" <> 'deleting'
        and "media_objects"."cleanup_claim_token" is null
        and "media_objects"."cleanup_claimed_at" is null
      ));