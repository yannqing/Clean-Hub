import type { MobileAuthContext } from "@cleanhub/api-client";

export type LoginMode = "customer-otp" | "customer-password" | "driver" | "owner";

export type AuthShellState = {
  tenantCode: string | null;
  session: {
    authContext: MobileAuthContext;
  } | null;
};
