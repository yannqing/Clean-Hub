/**
 * POS customer management — DTOs.
 *
 * NOTE: this module is a scaffold. Field shapes are placeholders and will be
 * aligned with the `customers` table (packages/db/src/schema/commerce/customer.ts) once
 * the repository/service layer is implemented.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosCustomerStatus = "active" | "blocked";

export type PosCustomerSummary = {
  id: string;
  fullName: string;
  phone: string;
  status: PosCustomerStatus;
};

export type PosCustomerDetail = PosCustomerSummary & {
  address: string | null;
  notes: string | null;
  orderCount: number;
  createdAt: string;
};

export type PosCustomerListQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type CreatePosCustomerRequest = {
  fullName: string;
  phone: string;
  address?: string;
  notes?: string;
};

export type PosCustomerListInput = {
  authContext: AuthContext;
  query: PosCustomerListQuery;
};

export type PosCustomerDetailInput = {
  authContext: AuthContext;
  customerId: string;
};

export type CreatePosCustomerInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosCustomerRequest;
};
