CREATE TABLE "auth_login_lockouts" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"lock_key" varchar(320) NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_login_lockouts_lock_key_unique" ON "auth_login_lockouts" USING btree ("lock_key");