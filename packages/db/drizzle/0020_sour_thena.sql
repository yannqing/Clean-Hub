DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "users"
		WHERE
			("email" IS NULL) <> ("normalized_email" IS NULL)
			OR (
				"email" IS NOT NULL
				AND (
					btrim("email") = ''
					OR "normalized_email" IS DISTINCT FROM lower(btrim("email"))
				)
			)
	) THEN
		RAISE EXCEPTION
			'Cannot enforce email normalization: users.email and users.normalized_email contain inconsistent values. Resolve them before retrying this migration.';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalization_check" CHECK (("users"."email" is null and "users"."normalized_email" is null) or ("users"."email" is not null and "users"."normalized_email" = lower(btrim("users"."email")) and "users"."normalized_email" <> ''));
