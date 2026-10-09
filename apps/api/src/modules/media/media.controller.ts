import type { Context } from "hono";
import { z } from "zod";

import type { AppBindings } from "../../http/types.js";
import { MediaError } from "./media.types.js";
import type { MediaService } from "./media.service.js";

const requestUploadBodySchema = z.object({
  purpose: z.enum(["delivery_proof", "delivery_signature"]),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  entityId: z.string().trim().min(1).max(120).optional(),
});

export type MediaControllerOptions = {
  mediaService: MediaService;
};

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function errorResponse(c: Context<AppBindings>, error: MediaError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
      ...(error.details ? { details: error.details } : {}),
    },
    error.status,
  );
}

export function createMediaController({
  mediaService,
}: MediaControllerOptions) {
  return {
    requestUpload: async (c: Context<AppBindings>) => {
      const body = requestUploadBodySchema.parse(await readJson(c));
      const authContext = c.get("mobileAuthContext");

      try {
        const result = await mediaService.requestUpload({
          tenantId: authContext.tenantId,
          actorUserId: authContext.subjectId,
          purpose: body.purpose,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
          entityId: body.entityId,
        });

        c.get("logger").info(
          {
            tenantId: authContext.tenantId,
            subjectId: authContext.subjectId,
            objectKey: result.objectKey,
            purpose: body.purpose,
            sizeBytes: body.sizeBytes,
          },
          "Created media upload ticket",
        );

        return c.json(result, 201);
      } catch (error) {
        if (error instanceof MediaError) {
          return errorResponse(c, error);
        }

        throw error;
      }
    },
  };
}
