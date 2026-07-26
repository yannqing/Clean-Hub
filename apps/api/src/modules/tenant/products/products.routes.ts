import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantProductController,
  getTenantProductOverviewController,
  getTenantProductCategoryAttributesController,
  listTenantProductCategoriesController,
  listTenantProductsController,
  requestTenantProductMediaUploadController,
} from "./products.controller.js";

export function createTenantProductRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getTenantProductOverviewController);
  routes.get("/categories", listTenantProductCategoriesController);
  routes.get(
    "/categories/:categoryId/attributes",
    getTenantProductCategoryAttributesController,
  );
  routes.post("/media/uploads", requestTenantProductMediaUploadController);
  routes.get("/", listTenantProductsController);
  routes.post("/", createTenantProductController);

  return routes;
}
