import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  clearCurrentPosCartController,
  claimParkedPosCartController,
  getCurrentPosCartController,
  listParkedPosCartsController,
  parkCurrentPosCartController,
  previewPosCartController,
  saveCurrentPosCartController,
} from "./carts.controller.js";

export function createPosCartsRoutes() {
  const routes = new Hono<AppBindings>();
  routes.post("/preview", previewPosCartController);
  routes.get("/parked", listParkedPosCartsController);
  routes.get("/current", getCurrentPosCartController);
  routes.put("/current", saveCurrentPosCartController);
  routes.delete("/current", clearCurrentPosCartController);
  routes.post("/current/park", parkCurrentPosCartController);
  routes.post("/:cartId/claim", claimParkedPosCartController);
  return routes;
}
