import type {
  AuthContext,
  PosBootstrapResponse,
  TenantProfile,
} from "@cleanhub/api-client";

export type TerminalBootstrapResponse = PosBootstrapResponse;

export type SetupAdminSession = {
  authContext: AuthContext;
  profile: TenantProfile;
};

export type SetupStep = "admin" | "branch" | "terminal" | "complete";
