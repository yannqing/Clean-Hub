import { getDb, type Database } from "@cleanhub/db";

import { writeSecurityEvent } from "./security-events.helper.js";
import {
  findSecurityEvents,
  hasSecurityEvents,
} from "./security-events.repository.js";
import type {
  SecurityEventListInput,
  SecurityEventListItem,
} from "./security-events.types.js";

async function seedSecurityEventsIfEmpty(db: Database): Promise<void> {
  if (await hasSecurityEvents(db)) {
    return;
  }

  await writeSecurityEvent(db, {
    eventType: "auth.login.failed",
    severity: "medium",
    ipAddress: "127.0.0.1",
    description: "Seeded local security event for failed login review.",
    metadata: { seeded: true },
  });
  await writeSecurityEvent(db, {
    eventType: "auth.refresh.reuse_detected",
    severity: "high",
    ipAddress: "127.0.0.1",
    description: "Seeded local security event for refresh token reuse review.",
    metadata: { seeded: true },
  });
  await writeSecurityEvent(db, {
    eventType: "security.settings.updated",
    severity: "low",
    ipAddress: "127.0.0.1",
    description: "Seeded local security event for settings audit review.",
    metadata: { seeded: true },
  });
}

export async function listSecurityEvents(
  input: SecurityEventListInput,
  db: Database = getDb(),
): Promise<SecurityEventListItem[]> {
  await seedSecurityEventsIfEmpty(db);

  return findSecurityEvents(db, input);
}
