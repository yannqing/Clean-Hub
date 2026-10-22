import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantTaxRateController,
  deleteTenantTaxRateController,
  listTenantTaxRatesController,
  updateTenantTaxRateController,
} from "./tax-rates.controller.js";
import {
  applyTaxTemplateController,
  listTaxTemplatesController,
} from "./tax-template.controller.js";

export function createTenantTaxRateRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantTaxRatesController);
  routes.get("/templates", listTaxTemplatesController);
  routes.post("/templates/apply", applyTaxTemplateController);
  routes.post("/", createTenantTaxRateController);
  routes.patch("/:taxRateId", updateTenantTaxRateController);
  routes.delete("/:taxRateId", deleteTenantTaxRateController);

  return routes;
}
