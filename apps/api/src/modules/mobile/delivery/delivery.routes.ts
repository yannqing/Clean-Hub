import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createDeliveryController } from "./delivery.controller.js";
import { DeliveryService } from "./delivery.service.js";

export type CreateDeliveryRoutesOptions = {
  deliveryService?: DeliveryService;
};

export function createDeliveryRoutes({
  deliveryService = new DeliveryService(),
}: CreateDeliveryRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createDeliveryController({ deliveryService });

  routes.get("/dispatch/board", controller.getDispatchBoard);
  routes.get("/tasks", controller.listTasks);
  routes.get("/tasks/today", controller.listTodayTasks);
  routes.post("/tasks", controller.createAssignedTask);
  routes.get("/tasks/:taskId", controller.getTaskDetail);
  routes.post("/tasks/:taskId/status", controller.updateStatus);
  routes.post("/tasks/:taskId/dispatch", controller.dispatchTask);
  routes.post("/tasks/:taskId/reassign", controller.reassignTask);
  routes.post("/tasks/:taskId/cancel", controller.cancelTask);
  routes.post("/tasks/:taskId/proofs", controller.uploadProof);
  routes.post("/tasks/:taskId/signature", controller.signTask);

  return routes;
}
