import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantBackupsError } from "./backups.errors.js";
import {
  createTenantBackupJob,
  createTenantRestoreRequest,
  listTenantBackupJobs,
} from "./backups.service.js";
import {
  backupJobListQuerySchema,
  backupJobParamsSchema,
  createBackupJobBodySchema,
  createRestoreRequestBodySchema,
} from "./backups.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

function createTenantBackupsErrorResponse(
  c: Context<AppBindings>,
  error: TenantBackupsError,
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

export async function listTenantBackupJobsController(c: Context<AppBindings>) {
  const query = backupJobListQuerySchema.parse(c.req.query());

  try {
    const backupJobs = await listTenantBackupJobs(c.get("authContext"), query);

    return c.json(backupJobs);
  } catch (error) {
    if (error instanceof TenantBackupsError) {
      return createTenantBackupsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createTenantBackupJobController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createBackupJobBodySchema.parse(rawBody);

  try {
    const backupJob = await createTenantBackupJob(c.get("authContext"), data, {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(backupJob, 201);
  } catch (error) {
    if (error instanceof TenantBackupsError) {
      return createTenantBackupsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function createTenantRestoreRequestController(
  c: Context<AppBindings>,
) {
  const params = backupJobParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createRestoreRequestBodySchema.parse(rawBody);

  try {
    const restoreRequest = await createTenantRestoreRequest(
      c.get("authContext"),
      params.backupId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(restoreRequest, 201);
  } catch (error) {
    if (error instanceof TenantBackupsError) {
      return createTenantBackupsErrorResponse(c, error);
    }

    throw error;
  }
}
