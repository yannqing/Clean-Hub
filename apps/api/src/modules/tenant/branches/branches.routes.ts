import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantBranchController,
  getTenantBranchController,
  listTenantBranchesController,
  requestTenantBranchLogoUploadController,
  updateTenantBranchController,
  updateTenantBranchStatusController,
} from "./branches.controller.js";

export function createTenantBranchRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantBranchesController);
  routes.post("/", createTenantBranchController);
  routes.post("/media/uploads", requestTenantBranchLogoUploadController);
  routes.patch("/:branchId/status", updateTenantBranchStatusController);
  routes.get("/:branchId", getTenantBranchController);
  routes.patch("/:branchId", updateTenantBranchController);

  return routes;
}
