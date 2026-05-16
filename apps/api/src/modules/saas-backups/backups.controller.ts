import type { AppBindings } from "../../http/types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { listBackupJobs } from "./backups.service.js";
import { backupJobListQuerySchema } from "./backups.validation.js";

export async function listBackupJobsController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const query = backupJobListQuerySchema.parse({
    scope: c.req.query("scope"),
    status: c.req.query("status"),
    tenantId: c.req.query("tenantId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const backupJobs = await listBackupJobs(query);

  return c.json(backupJobs);
}
