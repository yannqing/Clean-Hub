/**
 * 客户接待 — data access via the shared api-client.
 *
 * Thin wrappers around `posApi.pos.customers` / `posApi.pos.accounts` so the
 * intake feature talks to the api-client directly (not the customers feature's
 * internal queries) to keep feature boundaries clean.
 */
import type { PosCustomerListResult } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";

import type {
  IntakeCreateAccountInput,
  IntakeCreateProfileInput,
  IntakeLookupRow,
  IntakeProfileQuery,
} from "../types";

/** Result of the create-customer-account flow. */
export type IntakeCreatedAccount = {
  accountId: string;
  accountName: string;
  phone: string | null;
  email: string | null;
};

/** Result of the create-customer-profile flow. */
export type IntakeCreatedProfile = {
  profileId: string;
  customerAccountId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

/** Account option for the profile-dialog account selector. */
export type IntakeAccountOption = {
  id: string;
  accountName: string;
  phone: string | null;
  email: string | null;
};

type IntakeProfileListResult = {
  rows: IntakeLookupRow[];
  total: number;
};

type IntakeAccountProfileListResult = {
  rows: Extract<IntakeLookupRow, { kind: "profile" }>[];
  total: number;
};

function toRow(entry: PosCustomerListResult["data"][number]): IntakeLookupRow {
  if (entry.kind === "account") {
    return {
      kind: "account",
      id: entry.account.id,
      accountName: entry.account.accountName,
      phone: entry.account.phone,
      email: entry.account.email,
      status: entry.account.status,
      createdAt: entry.account.createdAt,
    };
  }

  const profile = entry.profile;
  return {
    kind: "profile",
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
 * Search customer accounts and profiles by keyword. Pagination follows the
 * same limit/offset convention as the customer-management list.
 */
export async function searchIntakeProfiles(
  query: IntakeProfileQuery,
): Promise<IntakeProfileListResult> {
  const offset = Math.max(0, (query.page - 1) * query.pageSize);
  const result = await posApi.pos.customers.list({
    q: query.q.trim() || undefined,
    limit: query.pageSize,
    offset,
  });

  return { rows: result.data.map(toRow), total: result.total };
}

/** List profiles under a selected account for the intake account drill-down. */
export async function listIntakeAccountProfiles(
  account: IntakeAccountOption,
  query: IntakeProfileQuery,
): Promise<IntakeAccountProfileListResult> {
  const offset = Math.max(0, (query.page - 1) * query.pageSize);
  const result = await posApi.pos.accounts.listProfiles(account.id, {
    q: query.q.trim() || undefined,
    limit: query.pageSize,
    offset,
  });

  return {
    rows: result.data.map((profile) => ({
      kind: "profile" as const,
      id: profile.id,
      customerAccountId: profile.customerAccountId,
      accountName: account.accountName,
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      status: profile.status,
      createdAt: profile.createdAt,
    })),
    total: result.total,
  };
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

  return {
    accountId: account.id,
    accountName: account.accountName,
    phone: account.phone,
    email: account.email,
  };
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
): Promise<IntakeCreatedProfile> {
  const profile = await posApi.pos.accounts.createProfile(input.accountId, {
    fullName: input.fullName.trim(),
    phone: input.profilePhone.trim() || undefined,
    email: input.profileEmail.trim() || undefined,
    relationship: input.relationship.trim() || undefined,
  });

  return {
    profileId: profile.id,
    customerAccountId: profile.customerAccountId,
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
  };
}
