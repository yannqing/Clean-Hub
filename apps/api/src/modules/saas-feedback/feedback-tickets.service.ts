import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import type { AuthContext } from "../auth/auth.types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { findFeedbackTickets } from "./feedback-tickets.repository.js";
import type {
  FeedbackTicketListInput,
  FeedbackTicketListItem,
} from "./feedback-tickets.types.js";

function requireFeedbackTicketListAccess(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin", "support"]);

  if (authContext.tenantId !== null) {
    throw new AuthError(
      "FORBIDDEN",
      "Tenant users cannot access SaaS feedback tickets.",
    );
  }
}

export async function listFeedbackTickets(
  authContext: AuthContext,
  input: FeedbackTicketListInput,
  db: Database = getDb(),
): Promise<FeedbackTicketListItem[]> {
  requireFeedbackTicketListAccess(authContext);

  return findFeedbackTickets(db, input);
}
