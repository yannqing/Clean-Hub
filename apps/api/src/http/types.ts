import type { AppLogger } from "@cleanhub/logger";

import type { AuthContext } from "../modules/auth/auth.types.js";
import type { MobileAuthContext } from "../modules/mobile/auth/auth.types.js";

export type AppBindings = {
  Variables: {
    authContext: AuthContext;
    mobileAuthContext: MobileAuthContext;
    logger: AppLogger;
    requestId: string;
  };
};

export type ApiErrorResponse = {
  message: string;
  code?: string;
  lockedUntil?: string;
  requestId?: string;
  validationErrors?: unknown;
};
