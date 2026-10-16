import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listPosCatalogController } from "./catalog.controller.js";

export function createPosCatalogRoutes() {
  const routes = new Hono<AppBindings>();
  routes.get("/", listPosCatalogController);
  return routes;
}
