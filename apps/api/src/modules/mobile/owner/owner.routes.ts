import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { createOwnerController } from "./owner.controller.js";
import { OwnerService } from "./owner.service.js";

export type CreateOwnerRoutesOptions = {
  ownerService?: OwnerService;
};

export function createOwnerRoutes({
  ownerService = new OwnerService(),
}: CreateOwnerRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createOwnerController({ ownerService });

  routes.get("/summary/today", controller.getTodaySummary);

  return routes;
}
