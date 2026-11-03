import { and, eq, sql } from "drizzle-orm";

import { tenantPaymentIntegrations, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  TenantPaymentIntegrationSummary,
  TenantPaymentProvider,
} from "./payment-integrations.types.js";

type PaymentIntegrationRow = typeof tenantPaymentIntegrations.$inferSelect;

export function toPaymentIntegrationSummary(
  row: PaymentIntegrationRow,
): TenantPaymentIntegrationSummary {
  return {
    provider: row.provider,
    configured: true,
    credentialHint: row.credentialHint,
    verificationStatus: row.verificationStatus,
    posEnabled: row.posEnabled && row.verificationStatus === "verified",
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    lastVerificationError: row.lastVerificationError,
  };
}

export async function findTenantPaymentIntegrationRows(
  db: Database,
  tenantId: string,
): Promise<PaymentIntegrationRow[]> {
  return db
    .select()
    .from(tenantPaymentIntegrations)
    .where(eq(tenantPaymentIntegrations.tenantId, tenantId));
}

export async function findTenantPaymentIntegrationRow(
  db: Database,
  input: { tenantId: string; provider: TenantPaymentProvider },
): Promise<PaymentIntegrationRow | null> {
  const rows = await db
    .select()
    .from(tenantPaymentIntegrations)
    .where(
      and(
        eq(tenantPaymentIntegrations.tenantId, input.tenantId),
        eq(tenantPaymentIntegrations.provider, input.provider),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findEnabledTenantPaymentProviders(
  db: Database,
  tenantId: string,
): Promise<TenantPaymentProvider[]> {
  const rows = await db
    .select({ provider: tenantPaymentIntegrations.provider })
    .from(tenantPaymentIntegrations)
    .where(
      and(
        eq(tenantPaymentIntegrations.tenantId, tenantId),
        eq(tenantPaymentIntegrations.verificationStatus, "verified"),
        eq(tenantPaymentIntegrations.posEnabled, true),
      ),
    );
  return rows.map((row) => row.provider);
}

export async function upsertTenantPaymentIntegration(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    provider: TenantPaymentProvider;
    encryptedCredentials: string;
    credentialHint: string;
    posEnabled: boolean;
  },
): Promise<PaymentIntegrationRow> {
  const now = new Date();
  const rows = await db
    .insert(tenantPaymentIntegrations)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      provider: input.provider,
      encryptedCredentials: input.encryptedCredentials,
      credentialHint: input.credentialHint,
      verificationStatus: "verified",
      posEnabled: input.posEnabled,
      verifiedAt: now,
      lastVerificationError: null,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: [
        tenantPaymentIntegrations.tenantId,
        tenantPaymentIntegrations.provider,
      ],
      set: {
        encryptedCredentials: input.encryptedCredentials,
        credentialHint: input.credentialHint,
        verificationStatus: "verified",
        posEnabled: input.posEnabled,
        verifiedAt: now,
        lastVerificationError: null,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${tenantPaymentIntegrations.version} + 1`,
      },
    })
    .returning();

  return rows[0]!;
}

export async function updateTenantPaymentVerification(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    provider: TenantPaymentProvider;
    valid: boolean;
    message: string;
  },
): Promise<PaymentIntegrationRow | null> {
  const rows = await db
    .update(tenantPaymentIntegrations)
    .set({
      verificationStatus: input.valid ? "verified" : "invalid",
      posEnabled: input.valid ? tenantPaymentIntegrations.posEnabled : false,
      verifiedAt: input.valid ? new Date() : null,
      lastVerificationError: input.valid ? null : input.message,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${tenantPaymentIntegrations.version} + 1`,
    })
    .where(
      and(
        eq(tenantPaymentIntegrations.tenantId, input.tenantId),
        eq(tenantPaymentIntegrations.provider, input.provider),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function updateTenantPaymentPosEnabled(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    provider: TenantPaymentProvider;
    posEnabled: boolean;
  },
): Promise<PaymentIntegrationRow | null> {
  const rows = await db
    .update(tenantPaymentIntegrations)
    .set({
      posEnabled: input.posEnabled,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${tenantPaymentIntegrations.version} + 1`,
    })
    .where(
      and(
        eq(tenantPaymentIntegrations.tenantId, input.tenantId),
        eq(tenantPaymentIntegrations.provider, input.provider),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function deleteTenantPaymentIntegrationRecord(
  db: Database,
  input: { tenantId: string; provider: TenantPaymentProvider },
): Promise<PaymentIntegrationRow | null> {
  const rows = await db
    .delete(tenantPaymentIntegrations)
    .where(
      and(
        eq(tenantPaymentIntegrations.tenantId, input.tenantId),
        eq(tenantPaymentIntegrations.provider, input.provider),
      ),
    )
    .returning();
  return rows[0] ?? null;
}
