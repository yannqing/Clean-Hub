import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { createPosAuthRoutes } from "./auth/auth.routes.js";
import { getMyPosBranchController } from "./branches/pos.controller.js";
import { createPosCustomersRoutes } from "./customers/customers.routes.js";
import { createPosNotificationsRoutes } from "./notifications/notifications.routes.js";
import { createPosOrdersRoutes } from "./orders/orders.routes.js";
import { createPosOverviewRoutes } from "./overview/overview.routes.js";
import { createPosReceptionRoutes } from "./reception/reception.routes.js";
import { createPosStaffRoutes } from "./staff/staff.routes.js";
import { createPosTicketsRoutes } from "./tickets/tickets.routes.js";

export function createPosRoutes() {
  const routes = new Hono<AppBindings>();

  // GET /pos/branches/me — the active branch for the signed-in POS user.
  routes.get("/branches/me", getMyPosBranchController);

  // Scaffold resources — handlers exist, service layer returns 501 until
  // the repository implementations land.
  routes.route("/auth", createPosAuthRoutes());
  routes.route("/customers", createPosCustomersRoutes());
  routes.route("/tickets", createPosTicketsRoutes());
  routes.route("/orders", createPosOrdersRoutes());
  routes.route("/overview", createPosOverviewRoutes());
  routes.route("/staff", createPosStaffRoutes());
  routes.route("/reception", createPosReceptionRoutes());
  routes.route("/notifications", createPosNotificationsRoutes());

  return routes;
}
