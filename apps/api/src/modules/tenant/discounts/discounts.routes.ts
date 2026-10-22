import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantDiscountController,
  deleteTenantDiscountController,
  getTenantDiscountController,
  getTenantDiscountListOptionsController,
  getTenantDiscountOptionsController,
  getTenantDiscountOverviewController,
  listTenantDiscountsController,
  updateTenantDiscountController,
  updateTenantDiscountStatusController,
} from "./discounts.controller.js";

export function createTenantDiscountRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getTenantDiscountOverviewController);
  routes.get("/list-options", getTenantDiscountListOptionsController);
  routes.get("/options", getTenantDiscountOptionsController);
  routes.get("/", listTenantDiscountsController);
  routes.post("/", createTenantDiscountController);
  routes.patch("/:discountId/status", updateTenantDiscountStatusController);
  routes.get("/:discountId", getTenantDiscountController);
  routes.patch("/:discountId", updateTenantDiscountController);
  routes.delete("/:discountId", deleteTenantDiscountController);

  return routes;
}
