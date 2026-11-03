import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantCustomerCommentController,
  deleteTenantCustomerCommentController,
  getTenantCustomerAccountDetailController,
  getTenantCustomerAccountOverviewController,
  getTenantCustomerDetailController,
  getTenantCustomerOverviewController,
  getTenantCustomerTimelineController,
  listTenantCustomerAccountCustomersController,
  listTenantCustomerAccountsController,
  listTenantCustomersController,
  requestTenantCustomerAttachmentUploadController,
  updateTenantCustomerCommentController,
  updateTenantCustomerController,
  resetTenantCustomerAccountPasswordController,
  updateTenantCustomerAccountController,
} from "./customers.controller.js";

export function createTenantCustomerRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getTenantCustomerOverviewController);
  routes.get("/accounts/overview", getTenantCustomerAccountOverviewController);
  routes.get("/accounts", listTenantCustomerAccountsController);
  routes.get(
    "/accounts/:accountId/customers",
    listTenantCustomerAccountCustomersController,
  );
  routes.get(
    "/accounts/:accountId",
    getTenantCustomerAccountDetailController,
  );
  routes.patch(
    "/accounts/:accountId",
    updateTenantCustomerAccountController,
  );
  // Staff hand the customer their first app password at the counter: customer
  // sign-in is OTP-first and the OTP is not delivered anywhere yet.
  routes.post(
    "/accounts/:accountId/password",
    resetTenantCustomerAccountPasswordController,
  );
  routes.get("/", listTenantCustomersController);
  routes.get("/:customerId/timeline", getTenantCustomerTimelineController);
  routes.post("/:customerId/comments", createTenantCustomerCommentController);
  routes.post(
    "/:customerId/media/uploads",
    requestTenantCustomerAttachmentUploadController,
  );
  routes.patch(
    "/:customerId/comments/:commentId",
    updateTenantCustomerCommentController,
  );
  routes.delete(
    "/:customerId/comments/:commentId",
    deleteTenantCustomerCommentController,
  );
  routes.patch("/:customerId", updateTenantCustomerController);
  routes.get("/:customerId", getTenantCustomerDetailController);

  return routes;
}
