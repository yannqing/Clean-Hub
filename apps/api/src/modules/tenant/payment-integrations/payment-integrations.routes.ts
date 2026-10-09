import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  configureTenantPaymentIntegrationController,
  deleteTenantPaymentIntegrationController,
  listTenantPaymentIntegrationsController,
  updateTenantPaymentIntegrationController,
  verifyTenantPaymentIntegrationController,
} from "./payment-integrations.controller.js";

export function createTenantPaymentIntegrationRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/", listTenantPaymentIntegrationsController);
  routes.put("/:provider", configureTenantPaymentIntegrationController);
  routes.post("/:provider/verify", verifyTenantPaymentIntegrationController);
  routes.patch("/:provider", updateTenantPaymentIntegrationController);
  routes.delete("/:provider", deleteTenantPaymentIntegrationController);
  return routes;
}
