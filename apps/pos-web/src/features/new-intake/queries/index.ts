/**
 * 客户接待 — data access via the shared api-client.
 *
 * Thin wrappers around `posApi.pos.customers` / `posApi.pos.accounts` so the
 * intake feature talks to the api-client directly (not the customers feature's
 * internal queries) to keep feature boundaries clean.
 */
import { posApi } from "@/lib/api-client";

import type { IntakeCreateAccountInput, IntakeCreateProfileInput, IntakeProfileQuery, IntakeProfileRow } from "../types";

/** Result of the create-customer-account flow. */
export type IntakeCreatedAccount = {
  accountId: string;
};

/** Account option for the profile-dialog account selector. */
export type IntakeAccountOption = {
  id: string;
  accountName: string;
  phone: string | null;
  email: string | null;
};

type IntakeProfileListResult = {
  rows: IntakeProfileRow[];
  total: number;
};

function toRow(
  entry:
    | { kind: "account"; account: unknown }
    | { kind: "profile"; profile: {
        id: string;
        customerAccountId: string;
        accountName: string;
        fullName: string;
        phone: string | null;
        email: string | null;
        status: "active" | "disabled";
        createdAt: string;
      } },
): IntakeProfileRow | null {
  if (entry.kind !== "profile") {
    return null;
  }
  const profile = entry.profile;
  return {
    id: profile.id,
    customerAccountId: profile.customerAccountId,
    accountName: profile.accountName,
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    status: profile.status,
    createdAt: profile.createdAt,
  };
}

/**
 * Search customer profiles by keyword. An empty keyword lists the most recent
 * profiles. Pagination follows the same limit/offset convention as the
 * customer-management list.
 */
export async function searchIntakeProfiles(
  query: IntakeProfileQuery,
): Promise<IntakeProfileListResult> {
  const offset = Math.max(0, (query.page - 1) * query.pageSize);
  const result = await posApi.pos.customers.list({
    q: query.q.trim() || undefined,
    resultType: "profile",
    limit: query.pageSize,
    offset,
  });

  const rows = result.data
    .map(toRow)
    .filter((row): row is IntakeProfileRow => row !== null);

  return { rows, total: result.total };
}

/**
 * Create a customer account (the shared contact holder). The account owns the
 * shared phone/email and may later have multiple profiles added beneath it.
 * Uniqueness (tenant-scoped phone/email) is enforced by the backend.
 */
export async function createIntakeAccount(
  input: IntakeCreateAccountInput,
): Promise<IntakeCreatedAccount> {
  const account = await posApi.pos.accounts.create({
    accountName: input.accountName.trim(),
    phone: input.accountPhone.trim() || undefined,
    email: input.accountEmail.trim() || undefined,
  });

  return { accountId: account.id };
}

/**
 * Search customer accounts by keyword for the profile-dialog account selector.
 * Pinned to `resultType: "account"` so it only returns account entries. An
 * empty keyword lists the most recent accounts.
 */
export async function searchIntakeAccounts(
  keyword: string,
): Promise<IntakeAccountOption[]> {
  const result = await posApi.pos.customers.list({
    q: keyword.trim() || undefined,
    resultType: "account",
    limit: 50,
    offset: 0,
  });

  return result.data
    .map((entry) => {
      if (entry.kind !== "account") return null;
      const account = entry.account;
      return {
        id: account.id,
        accountName: account.accountName,
        phone: account.phone,
        email: account.email,
      } satisfies IntakeAccountOption;
    })
    .filter((entry): entry is IntakeAccountOption => entry !== null);
}

/**
 * Create a customer profile beneath an existing account. The account owns the
 * shared contact info; the profile is the actual person receiving service.
 */
export async function createIntakeProfile(
  input: IntakeCreateProfileInput,
): Promise<{ profileId: string }> {
  const profile = await posApi.pos.accounts.createProfile(input.accountId, {
    fullName: input.fullName.trim(),
    phone: input.profilePhone.trim() || undefined,
    email: input.profileEmail.trim() || undefined,
    relationship: input.relationship.trim() || undefined,
  });

  return { profileId: profile.id };
}
