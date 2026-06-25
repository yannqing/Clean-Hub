import type { Context } from "hono";
import { z } from "zod";

import { getRequestMeta } from "../../../http/request-meta.js";
import type { AppBindings } from "../../../http/types.js";
import { AuthError } from "../../auth/auth.errors.js";
import type { MobileAuthService } from "./auth.service.js";
import type { MobileAuthResult, MobileTokenResponse } from "./auth.types.js";

const tenantCodeSchema = z.string().trim().min(1).max(120);
const phoneSchema = z.string().trim().min(3).max(32);
const identifierSchema = z.string().trim().min(1).max(320);
const passwordSchema = z.string().min(1).max(1024);
const otpCodeSchema = z.string().trim().min(4).max(16);
const deviceIdSchema = z.string().trim().min(1).max(120).optional();
const refreshTokenSchema = z.string().trim().min(1);

const requestOtpBodySchema = z.object({
  tenantCode: tenantCodeSchema,
  phone: phoneSchema,
  deviceId: deviceIdSchema,
});

const testOtpQuerySchema = z.object({
  tenantCode: tenantCodeSchema,
  phone: phoneSchema,
});

const verifyOtpBodySchema = requestOtpBodySchema.extend({
  code: otpCodeSchema,
});

const customerPasswordBodySchema = z.object({
  tenantCode: tenantCodeSchema,
  identifier: identifierSchema,
  password: passwordSchema,
  deviceId: deviceIdSchema,
});

const staffLoginBodySchema = customerPasswordBodySchema;

const refreshBodySchema = z.object({
  refreshToken: refreshTokenSchema,
  deviceId: deviceIdSchema,
});

const logoutBodySchema = refreshBodySchema;

export type MobileAuthControllerOptions = {
  mobileAuthService: MobileAuthService;
};

function toTokenResponse(result: MobileAuthResult): MobileTokenResponse {
  return {
    authContext: result.authContext,
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    accessTokenExpiresAt: result.tokens.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt.toISOString(),
    tokenType: "Bearer",
  };
}

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function getBearerToken(c: Context<AppBindings>): string {
  const authorization = c.req.header("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new AuthError("TOKEN_INVALID", "Bearer access token is required.");
  }

  return authorization.slice("Bearer ".length).trim();
}

export function createMobileAuthController({
  mobileAuthService,
}: MobileAuthControllerOptions) {
  return {
    requestCustomerOtp: async (c: Context<AppBindings>) => {
      const body = requestOtpBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.requestCustomerOtp({
        tenantCode: body.tenantCode,
        phone: body.phone,
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(result, 201);
    },

    getCustomerTestOtp: async (c: Context<AppBindings>) => {
      const query = testOtpQuerySchema.parse(c.req.query());
      const result = await mobileAuthService.getCustomerTestOtp({
        tenantCode: query.tenantCode,
        phone: query.phone,
        ...getRequestMeta(c),
      });

      return c.json(result);
    },

    verifyCustomerOtp: async (c: Context<AppBindings>) => {
      const body = verifyOtpBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.verifyCustomerOtp({
        tenantCode: body.tenantCode,
        phone: body.phone,
        code: body.code,
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(toTokenResponse(result));
    },

    loginCustomerWithPassword: async (c: Context<AppBindings>) => {
      const body = customerPasswordBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.loginCustomerWithPassword({
        tenantCode: body.tenantCode,
        identifier: body.identifier,
        password: body.password,
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(toTokenResponse(result));
    },

    loginDriver: async (c: Context<AppBindings>) => {
      const body = staffLoginBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.loginStaff({
        tenantCode: body.tenantCode,
        identifier: body.identifier,
        password: body.password,
        role: "driver",
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(toTokenResponse(result));
    },

    loginOwner: async (c: Context<AppBindings>) => {
      const body = staffLoginBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.loginStaff({
        tenantCode: body.tenantCode,
        identifier: body.identifier,
        password: body.password,
        role: "owner",
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(toTokenResponse(result));
    },

    refresh: async (c: Context<AppBindings>) => {
      const body = refreshBodySchema.parse(await readJson(c));
      const result = await mobileAuthService.refresh({
        refreshToken: body.refreshToken,
        ...getRequestMeta(c, body.deviceId),
      });

      return c.json(toTokenResponse(result));
    },

    logout: async (c: Context<AppBindings>) => {
      const body = logoutBodySchema.parse(await readJson(c));
      await mobileAuthService.logout({
        refreshToken: body.refreshToken,
        ...getRequestMeta(c, body.deviceId),
      });

      return c.body(null, 204);
    },

    me: async (c: Context<AppBindings>) => {
      const authContext = await mobileAuthService.getMobileAuthContext(
        getBearerToken(c),
      );

      return c.json(authContext);
    },
  };
}
