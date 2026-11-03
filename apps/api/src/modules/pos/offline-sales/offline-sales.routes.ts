import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  acknowledgeRecoveredOfflineSaleExceptionController,
  getOfflineSaleExceptionController,
  listOfflineSaleExceptionsController,
  reportOfflineSaleExceptionController,
  resolveOfflineSaleExceptionController,
} from "./offline-sales.controller.js";

export function createPosOfflineSaleRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/", listOfflineSaleExceptionsController);
  routes.post("/", reportOfflineSaleExceptionController);
  routes.get("/:commandId", getOfflineSaleExceptionController);
  routes.post("/:commandId/resolve", resolveOfflineSaleExceptionController);
  routes.post(
    "/:commandId/acknowledge-recovered",
    acknowledgeRecoveredOfflineSaleExceptionController,
  );
  return routes;
}
