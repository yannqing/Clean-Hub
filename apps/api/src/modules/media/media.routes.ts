import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { createMediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

export type CreateMediaRoutesOptions = {
  mediaService?: MediaService;
};

export function createMediaRoutes({
  mediaService = new MediaService(),
}: CreateMediaRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();
  const controller = createMediaController({ mediaService });

  routes.post("/uploads", controller.requestUpload);

  return routes;
}
