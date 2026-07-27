import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantProductController,
  getTenantProductController,
  getTenantProductOverviewController,
  getTenantProductCategoryAttributesController,
  listTenantProductCategoriesController,
  listTenantProductsController,
  requestTenantProductMediaDownloadsController,
  requestTenantProductMediaUploadController,
  updateTenantProductController,
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
  routes.post("/media/downloads", requestTenantProductMediaDownloadsController);
  routes.get("/", listTenantProductsController);
  routes.post("/", createTenantProductController);
  routes.patch("/:productId", updateTenantProductController);
  routes.get("/:productId", getTenantProductController);

  return routes;
}
