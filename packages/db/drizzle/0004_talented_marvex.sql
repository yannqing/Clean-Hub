-- Backfill legacy rows before enforcing NOT NULL (dev seed PIN: 1234).
UPDATE "users"
SET "pin_hash" = 'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g'
WHERE "pin_hash" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "pin_hash" SET NOT NULL;