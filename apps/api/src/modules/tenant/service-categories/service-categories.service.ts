import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireFeatureEnabled,
} from "../../auth/permission.helper.js";
import { findServiceCategories } from "./service-categories.repository.js";
import type {
  ServiceCategoryListInput,
  ServiceCategorySummary,
} from "./service-categories.types.js";

export async function listTenantServiceCategories(
  authContext: AuthContext,
  input: ServiceCategoryListInput,
  db: Database = getDb(),
): Promise<ServiceCategorySummary[]> {
  assertTenantContext(authContext);
  await assertActiveTenant(authContext, db);

  if (input.businessLine) {
    await requireFeatureEnabled(authContext, input.businessLine, db);
  }

  return findServiceCategories(db, {
    ...input,
    tenantId: authContext.tenantId!,
  });
}
