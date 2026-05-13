import { type Database, users } from "@cleanhub/db";
import { eq } from "drizzle-orm";

export async function getUsers(db: Database, id: string) {
  return db.select().from(users).where(eq(users.id, id));
}
