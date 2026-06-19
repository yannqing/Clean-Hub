import type { Database } from "@cleanhub/db";

import { insertSecurityEvent } from "./security-events.repository.js";
import type { WriteSecurityEventInput } from "./security-events.types.js";

export async function writeSecurityEvent(
  db: Database,
  input: WriteSecurityEventInput,
): Promise<void> {
  await insertSecurityEvent(db, input);
}
