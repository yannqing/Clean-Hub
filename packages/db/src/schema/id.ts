import { createId, ULID_LENGTH } from "@cleanhub/id";
import { varchar } from "drizzle-orm/pg-core";

export function ulidColumn(name: string) {
  return varchar(name, { length: ULID_LENGTH });
}

export function ulidPrimaryKey(name = "id") {
  return ulidColumn(name).primaryKey().$defaultFn(createId);
}
