import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  clearCurrentPosCartController,
  getCurrentPosCartController,
  previewPosCartController,
  saveCurrentPosCartController,
} from "./carts.controller.js";

export function createPosCartsRoutes() {
  const routes = new Hono<AppBindings>();
  routes.post("/preview", previewPosCartController);
  routes.get("/current", getCurrentPosCartController);
  routes.put("/current", saveCurrentPosCartController);
  routes.delete("/current", clearCurrentPosCartController);
  return routes;
}
