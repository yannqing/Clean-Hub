import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createCustomerController } from "./customer.controller.js";
import { CustomerService } from "./customer.service.js";

export type CreateCustomerRoutesOptions = {
  customerService?: CustomerService;
};

export function createCustomerRoutes({
  customerService = new CustomerService(),
}: CreateCustomerRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createCustomerController({ customerService });

  routes.get("/profile", controller.getProfile);
  routes.get("/orders", controller.listOrdersAndTickets);
  routes.get("/orders/:id", controller.getOrderDetail);
  routes.get("/tickets/:id", controller.getTicketDetail);
  routes.get("/appointments", controller.listAppointments);
  routes.post("/appointments", controller.createAppointment);
  routes.post("/appointments/:id/cancel", controller.cancelAppointment);

  return routes;
}
