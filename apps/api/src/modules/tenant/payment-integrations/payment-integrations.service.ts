import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
} from "./payment-integrations.crypto.js";
import { TenantPaymentIntegrationError } from "./payment-integrations.errors.js";
import { verifyPaymentCredentials } from "./payment-integrations.provider.js";
import {
  deleteTenantPaymentIntegrationRecord,
  findTenantPaymentIntegrationRow,
  findTenantPaymentIntegrationRows,
  toPaymentIntegrationSummary,
  updateTenantPaymentPosEnabled,
  updateTenantPaymentVerification,
  upsertTenantPaymentIntegration,
} from "./payment-integrations.repository.js";
import type {
  ConfigureTenantPaymentIntegrationRequest,
  TenantPaymentCredentials,
  TenantPaymentIntegrationInput,
  TenantPaymentIntegrationSummary,
  TenantPaymentProvider,
  UpdateTenantPaymentIntegrationRequest,
} from "./payment-integrations.types.js";

const PAYMENT_PROVIDERS: TenantPaymentProvider[] = ["wave", "orange_money"];

function requireTenantId(
  input: TenantPaymentIntegrationInput<unknown>,
): string {
  assertTenantContext(input.authContext);
  return input.authContext.tenantId!;
}

function notConfiguredSummary(
  provider: TenantPaymentProvider,
): TenantPaymentIntegrationSummary {
  return {
    provider,
    configured: false,
    credentialHint: null,
    verificationStatus: "not_configured",
    posEnabled: false,
    verifiedAt: null,
    updatedAt: null,
    version: null,
    lastVerificationError: null,
  };
}

function toCredentials(
  input: ConfigureTenantPaymentIntegrationRequest,
): TenantPaymentCredentials {
  return input.provider === "wave"
    ? {
        provider: "wave",
        apiKey: input.apiKey,
        ...(input.signingSecret ? { signingSecret: input.signingSecret } : {}),
      }
    : {
        provider: "orange_money",
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        merchantKey: input.merchantKey,
      };
}

function credentialHint(credentials: TenantPaymentCredentials): string {
  const value =
    credentials.provider === "wave" ? credentials.apiKey : credentials.clientId;
  return value.length <= 8
    ? "••••••••"
    : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

async function auditPaymentIntegration(
  db: Database,
  input: TenantPaymentIntegrationInput<unknown>,
  eventType: string,
  before: TenantPaymentIntegrationSummary | null,
  after: TenantPaymentIntegrationSummary | null,
): Promise<void> {
  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: input.authContext.tenantId,
    eventCategory: "payment_integration",
    eventType,
    entityType: "tenant_payment_integration",
    entityId: after?.provider ?? before?.provider ?? input.provider,
    before,
    after,
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });
}

export async function listTenantPaymentIntegrations(
  input: Omit<TenantPaymentIntegrationInput, "provider" | "data">,
  db: Database = getDb(),
): Promise<TenantPaymentIntegrationSummary[]> {
  assertTenantContext(input.authContext);
  requireTenantRole(input.authContext, ["owner", "manager"]);
  await assertActiveTenant(input.authContext, db);
  const rows = await findTenantPaymentIntegrationRows(
    db,
    input.authContext.tenantId!,
  );
  const byProvider = new Map(
    rows.map((row) => [row.provider, toPaymentIntegrationSummary(row)]),
  );
  return PAYMENT_PROVIDERS.map(
    (provider) => byProvider.get(provider) ?? notConfiguredSummary(provider),
  );
}

export async function configureTenantPaymentIntegration(
  input: TenantPaymentIntegrationInput<ConfigureTenantPaymentIntegrationRequest>,
  db: Database = getDb(),
): Promise<TenantPaymentIntegrationSummary> {
  const tenantId = requireTenantId(input);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  if (input.data.provider !== input.provider) {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_PROVIDER_MISMATCH",
      "The payment provider does not match the request path.",
      400,
    );
  }

  const credentials = toCredentials(input.data);
  const verification = await verifyPaymentCredentials(credentials);
  if (!verification.valid) {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_CREDENTIALS_INVALID",
      verification.message,
      422,
    );
  }

  const beforeRow = await findTenantPaymentIntegrationRow(db, {
    tenantId,
    provider: input.provider,
  });
  const before = beforeRow ? toPaymentIntegrationSummary(beforeRow) : null;
  const encryptedCredentials = encryptPaymentCredentials(tenantId, credentials);

  return db.transaction(async (tx) => {
    const row = await upsertTenantPaymentIntegration(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      provider: input.provider,
      encryptedCredentials,
      credentialHint: credentialHint(credentials),
      posEnabled: input.data.posEnabled ?? false,
    });
    const after = toPaymentIntegrationSummary(row);
    await auditPaymentIntegration(
      tx,
      input,
      "payment_integration.configured",
      before,
      after,
    );
    return after;
  });
}

export async function verifyTenantPaymentIntegration(
  input: TenantPaymentIntegrationInput,
  db: Database = getDb(),
): Promise<TenantPaymentIntegrationSummary> {
  const tenantId = requireTenantId(input);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const current = await findTenantPaymentIntegrationRow(db, {
    tenantId,
    provider: input.provider,
  });
  if (!current) {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_INTEGRATION_NOT_FOUND",
      "Payment integration is not configured.",
      404,
    );
  }

  const before = toPaymentIntegrationSummary(current);
  const credentials = decryptPaymentCredentials(
    tenantId,
    input.provider,
    current.encryptedCredentials,
  );
  const verification = await verifyPaymentCredentials(credentials);

  return db.transaction(async (tx) => {
    const row = await updateTenantPaymentVerification(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      provider: input.provider,
      valid: verification.valid,
      message: verification.message,
    });
    if (!row) {
      throw new TenantPaymentIntegrationError(
        "PAYMENT_INTEGRATION_NOT_FOUND",
        "Payment integration is not configured.",
        404,
      );
    }
    const after = toPaymentIntegrationSummary(row);
    await auditPaymentIntegration(
      tx,
      input,
      "payment_integration.verified",
      before,
      after,
    );
    return after;
  });
}

export async function updateTenantPaymentIntegration(
  input: TenantPaymentIntegrationInput<UpdateTenantPaymentIntegrationRequest>,
  db: Database = getDb(),
): Promise<TenantPaymentIntegrationSummary> {
  const tenantId = requireTenantId(input);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);
  const current = await findTenantPaymentIntegrationRow(db, {
    tenantId,
    provider: input.provider,
  });
  if (!current) {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_INTEGRATION_NOT_FOUND",
      "Payment integration is not configured.",
      404,
    );
  }
  if (input.data.posEnabled && current.verificationStatus !== "verified") {
    throw new TenantPaymentIntegrationError(
      "PAYMENT_INTEGRATION_NOT_VERIFIED",
      "Verify the payment integration before enabling it on POS terminals.",
      409,
    );
  }

  const before = toPaymentIntegrationSummary(current);
  return db.transaction(async (tx) => {
    const row = await updateTenantPaymentPosEnabled(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      provider: input.provider,
      posEnabled: input.data.posEnabled,
    });
    if (!row) {
      throw new TenantPaymentIntegrationError(
        "PAYMENT_INTEGRATION_NOT_FOUND",
        "Payment integration is not configured.",
        404,
      );
    }
    const after = toPaymentIntegrationSummary(row);
    await auditPaymentIntegration(
      tx,
      input,
      "payment_integration.pos_availability_updated",
      before,
      after,
    );
    return after;
  });
}

export async function deleteTenantPaymentIntegration(
  input: TenantPaymentIntegrationInput,
  db: Database = getDb(),
): Promise<{ deleted: true; provider: TenantPaymentProvider }> {
  const tenantId = requireTenantId(input);
  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);

  return db.transaction(async (tx) => {
    const row = await deleteTenantPaymentIntegrationRecord(tx, {
      tenantId,
      provider: input.provider,
    });
    if (!row) {
      throw new TenantPaymentIntegrationError(
        "PAYMENT_INTEGRATION_NOT_FOUND",
        "Payment integration is not configured.",
        404,
      );
    }
    await auditPaymentIntegration(
      tx,
      input,
      "payment_integration.removed",
      toPaymentIntegrationSummary(row),
      null,
    );
    return { deleted: true, provider: input.provider };
  });
}
