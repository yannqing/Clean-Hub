import { getDb } from "@cleanhub/db";
import { selectedServiceItemGroups } from "@cleanhub/domain/service-item-catalog";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../http/types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireSaasRole,
} from "../auth/permission.helper.js";
import {
  requireAnyPosBranchAccess,
  requirePosTenantId,
} from "../pos/access-control.helper.js";
import {
  findPlatformItemCatalog,
  findTenantItemCatalog,
} from "./service-item-catalog.repository.js";
import {
  savePlatformItemGroup,
  saveTenantItemSelection,
  ServiceItemCatalogError,
} from "./service-item-catalog.service.js";
import {
  saveCatalogGroupSchema,
  saveCatalogSelectionSchema,
} from "./service-item-catalog.validation.js";

const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export function createSaasItemCatalogRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/", async (c) => {
    requireSaasRole(c.get("authContext"), ["super_admin", "support"]);
    return c.json({ data: await findPlatformItemCatalog(getDb()) });
  });
  routes.put("/:groupId", async (c) => {
    const data = saveCatalogGroupSchema.parse(await c.req.json());
    const groupId = idSchema.parse(c.req.param("groupId"));
    try {
      return c.json(
        await savePlatformItemGroup(
          getDb(),
          c.get("authContext"),
          groupId,
          data,
          {
            ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
            userAgent: c.req.header("user-agent"),
          },
        ),
      );
    } catch (error) {
      if (error instanceof ServiceItemCatalogError)
        return c.json(
          { code: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  return routes;
}

export function createTenantItemSelectionRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/:tenantId/item-catalog", async (c) => {
    requireSaasRole(c.get("authContext"), ["super_admin", "support"]);
    const tenantId = idSchema.parse(c.req.param("tenantId"));
    const catalog = await findTenantItemCatalog(getDb(), tenantId);
    if (!catalog.version)
      return c.json(
        {
          code: "TENANT_SETTINGS_NOT_FOUND",
          message: "Tenant settings were not found.",
        },
        404,
      );
    return c.json(catalog);
  });
  routes.put("/:tenantId/item-catalog", async (c) => {
    const tenantId = idSchema.parse(c.req.param("tenantId"));
    const data = saveCatalogSelectionSchema.parse(await c.req.json());
    try {
      return c.json(
        await saveTenantItemSelection(
          getDb(),
          c.get("authContext"),
          tenantId,
          data.selection,
          data.version,
          {
            ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
            userAgent: c.req.header("user-agent"),
          },
        ),
      );
    } catch (error) {
      if (error instanceof ServiceItemCatalogError)
        return c.json(
          { code: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
  return routes;
}

export function createEffectiveItemCatalogRoutes(pos: boolean) {
  const routes = new Hono<AppBindings>();
  routes.get("/", async (c) => {
    const auth = c.get("authContext");
    const tenantId = pos
      ? requirePosTenantId(auth)
      : (assertTenantContext(auth), auth.tenantId!);
    if (pos) requireAnyPosBranchAccess(auth);
    await assertActiveTenant(auth, getDb());
    const catalog = await findTenantItemCatalog(getDb(), tenantId);
    return c.json({
      ...catalog,
      groups: pos ? selectedServiceItemGroups(catalog) : catalog.groups,
    });
  });
  return routes;
}
