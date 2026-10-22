import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosReceptionEventController,
  getPosReceptionSummaryController,
  listPosReceptionEventsController,
} from "./reception.controller.js";

/**
 * POS reception (front-desk) routes. Scaffold: handlers exist, service layer
 * returns 501 until implemented.
 */
export function createPosReceptionRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosReceptionEventsController);
  routes.post("/", createPosReceptionEventController);
  routes.get("/summary", getPosReceptionSummaryController);

  return routes;
}
