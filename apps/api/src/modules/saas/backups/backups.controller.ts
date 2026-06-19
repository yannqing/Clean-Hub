import type { AppBindings } from "../../../http/types.js";
import {
  createBackupJob,
  createRestoreRequest,
  listBackupJobs,
  listRestoreRequests,
} from "./backups.service.js";
import {
  backupJobListQuerySchema,
  backupJobParamsSchema,
  createBackupJobBodySchema,
  createRestoreRequestBodySchema,
  restoreRequestListQuerySchema,
} from "./backups.validation.js";
import { BackupsError } from "./backups.errors.js";

function getClientIp(c: import("hono").Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createBackupsErrorResponse(
  c: import("hono").Context<AppBindings>,
  error: BackupsError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listBackupJobsController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");
  const query = backupJobListQuerySchema.parse({
    scope: c.req.query("scope"),
    status: c.req.query("status"),
    tenantId: c.req.query("tenantId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const backupJobs = await listBackupJobs(authContext, query);

  return c.json(backupJobs);
}

export async function createBackupJobController(
  c: import("hono").Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createBackupJobBodySchema.parse(rawBody);
  const backupJob = await createBackupJob(c.get("authContext"), data, {
    requestId: c.get("requestId"),
    ipAddress: getClientIp(c),
    userAgent: c.req.header("user-agent"),
  });

  return c.json(backupJob, 201);
}

export async function createRestoreRequestController(
  c: import("hono").Context<AppBindings>,
) {
  const params = backupJobParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createRestoreRequestBodySchema.parse(rawBody);
  try {
    const restoreRequest = await createRestoreRequest(
      c.get("authContext"),
      params.backupId,
      data,
    );

    return c.json(restoreRequest, 201);
  } catch (error) {
    if (error instanceof BackupsError) {
      return createBackupsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function listRestoreRequestsController(
  c: import("hono").Context<AppBindings>,
) {
  const query = restoreRequestListQuerySchema.parse({
    status: c.req.query("status"),
    tenantId: c.req.query("tenantId"),
    backupJobId: c.req.query("backupJobId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const restoreRequests = await listRestoreRequests(c.get("authContext"), query);

  return c.json(restoreRequests);
}
