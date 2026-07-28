import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../../auth/permission.helper.js";
import { writeSecurityEvent } from "./security-events.helper.js";
import { SecurityEventError } from "./security-events.errors.js";
import {
  findSecurityEventById,
  findSecurityEvents,
  hasSecurityEvents,
} from "./security-events.repository.js";
import type {
  GetSecurityEventDetailInput,
  SecurityEventDetail,
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

export async function getSecurityEventDetail(
  input: GetSecurityEventDetailInput,
  db: Database = getDb(),
): Promise<SecurityEventDetail> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const event = await findSecurityEventById(db, input.eventId);

  if (!event) {
    throw new SecurityEventError(
      "SECURITY_EVENT_NOT_FOUND",
      "Security event was not found.",
      404,
    );
  }

  return event;
}
