import type { AppLogger } from "@cleanhub/logger";

import type { AuthContext } from "../modules/auth/auth.types.js";

export type AppBindings = {
  Variables: {
    authContext: AuthContext;
    logger: AppLogger;
    requestId: string;
  };
};

export type ApiErrorResponse = {
  message: string;
  code?: string;
  requestId?: string;
  validationErrors?: unknown;
};
