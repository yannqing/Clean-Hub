import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requirePosBranchId,
} from "../../auth/permission.helper.js";
import { findHardwareDevicesByBranch } from "./hardware.repository.js";
import type { PosHardwareDeviceSummary } from "./hardware.types.js";

/**
 * List hardware devices for the current POS user's branch.
 * Any POS role (owner/manager/cashier) can read the device list.
 */
export async function listPosHardwareDevices(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosHardwareDeviceSummary[]> {
  assertPosContext(authContext);
  const tenantId = authContext.tenantId!;

  // Use the first assigned branch for the POS user.
  const branchId = authContext.branchIds[0];
  if (!branchId) {
    return [];
  }

  await requirePosBranchId(authContext, branchId, db);

  return findHardwareDevicesByBranch(db, tenantId, branchId);
}
