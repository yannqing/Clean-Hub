DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "users"
		WHERE "normalized_email" IS NOT NULL
		GROUP BY "normalized_email"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION
			'Cannot enforce global user email uniqueness: duplicate normalized_email values exist. Resolve them before retrying this migration.';
	END IF;
END
$$;--> statement-breakpoint
DROP INDEX "users_tenant_normalized_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_unique" ON "users" USING btree ("normalized_email");
