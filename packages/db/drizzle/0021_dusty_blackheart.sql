ALTER TABLE "auth_login_lockouts" ALTER COLUMN "lock_key" SET DATA TYPE varchar(512);--> statement-breakpoint
DO $$
DECLARE
	lock_record RECORD;
	target_id varchar(26);
BEGIN
	FOR lock_record IN
		SELECT
			lockout."id",
			'global:' || "users"."normalized_email" AS new_key
		FROM "auth_login_lockouts" AS lockout
		INNER JOIN "users"
			ON "users"."normalized_email" IS NOT NULL
			AND right(
				lockout."lock_key",
				char_length("users"."normalized_email") + 1
			) = ':' || "users"."normalized_email"
		WHERE
			lockout."lock_key" <> 'global:' || "users"."normalized_email"
			AND (
				char_length(lockout."lock_key")
				- char_length(replace(lockout."lock_key", ':', ''))
			) = 1
	LOOP
		SELECT "id"
		INTO target_id
		FROM "auth_login_lockouts"
		WHERE
			"lock_key" = lock_record.new_key
			AND "id" <> lock_record."id"
		LIMIT 1;

		IF target_id IS NULL THEN
			UPDATE "auth_login_lockouts"
			SET
				"lock_key" = lock_record.new_key,
				"updated_at" = now()
			WHERE "id" = lock_record."id";
		ELSE
			UPDATE "auth_login_lockouts" AS target
			SET
				"failed_attempts" = least(
					2147483647::bigint,
					target."failed_attempts"::bigint + source."failed_attempts"::bigint
				)::integer,
				"locked_until" = CASE
					WHEN target."locked_until" IS NULL THEN source."locked_until"
					WHEN source."locked_until" IS NULL THEN target."locked_until"
					ELSE greatest(target."locked_until", source."locked_until")
				END,
				"updated_at" = greatest(target."updated_at", source."updated_at", now())
			FROM "auth_login_lockouts" AS source
			WHERE
				target."id" = target_id
				AND source."id" = lock_record."id";

			DELETE FROM "auth_login_lockouts"
			WHERE "id" = lock_record."id";
		END IF;
	END LOOP;
END
$$;
