import assert from "node:assert/strict";
import { Hono } from "hono";
import { z } from "zod";
import { localizeSystemNotification } from "@cleanhub/i18n/system-notifications";
import { AuthError } from "../modules/auth/auth.errors.js";
import { handleApiError } from "./error-handler.js";
import { localizeValidationMessage } from "./validation-messages.js";
import { resolveRequestLocale } from "./locale.js";
import type { AppBindings } from "./types.js";

async function main() {
  const app = new Hono<AppBindings>();
  app.use("*", async (c, next) => {
    c.set("locale", resolveRequestLocale(c.req.header("accept-language")));
    c.set("requestId", "fr-test-1");
    c.set("logger", {
      error: () => undefined,
    } as unknown as AppBindings["Variables"]["logger"]);
    await next();
  });
  app.onError(handleApiError);
  app.get("/auth", () => {
    throw new AuthError("USER_DISABLED", "User is disabled.");
  });
  app.post("/validation", async (c) => {
    z.object({
      email: z.email(),
      displayName: z.string().min(2),
      quantity: z.number().gt(0),
    }).parse(await c.req.json());
    return c.json({ ok: true });
  });
  const auth = await app.request("/auth", {
    headers: { "accept-language": "fr-SN,en;q=0.5" },
  });
  assert.equal(auth.status, 403);
  assert.deepEqual(await auth.json(), {
    message: "Cet utilisateur est désactivé.",
    code: "USER_DISABLED",
    requestId: "fr-test-1",
  });
  const response = await app.request("/validation", {
    method: "POST",
    headers: { "accept-language": "fr", "content-type": "application/json" },
    body: JSON.stringify({ email: "invalid", displayName: "A", quantity: 0 }),
  });
  const validation = await response.json();
  assert.equal(response.status, 422);
  assert.equal(validation.code, "VALIDATION_ERROR");
  assert.equal(validation.requestId, "fr-test-1");
  assert.match(validation.message, /validation de la requête/);
  assert.equal(
    validation.validationErrors.fieldErrors.email[0],
    "Saisissez une adresse e-mail valide.",
  );
  assert.equal(
    validation.validationErrors.fieldErrors.displayName[0],
    "Saisissez au moins 2 caractères.",
  );
  assert.equal(
    validation.validationErrors.fieldErrors.quantity[0],
    "La valeur doit être supérieure à 0.",
  );
  const custom = z
    .string()
    .regex(/^\d{6}$/, "PIN must be exactly 6 digits.")
    .safeParse("123");
  assert.equal(custom.success, false);
  if (!custom.success) {
    assert.equal(
      localizeValidationMessage(custom.error.issues[0]!, "fr"),
      "Le code PIN doit comporter exactement 6 chiffres.",
    );
  }
  const notice = {
    noticeType: "system",
    relatedType: "pos_terminal",
    relatedId: "pos-1",
    title: "POS synchronization error",
    content: "English cached text",
  };
  const localized = localizeSystemNotification(notice, "fr");
  assert.equal(localized.title, "Erreur de synchronisation POS");
  assert.ok(localized.content.includes("pos-1"));
  assert.equal(notice.content, "English cached text");
  const merchantNotice = { ...notice, noticeType: "business" };
  assert.equal(
    localizeSystemNotification(merchantNotice, "fr"),
    merchantNotice,
  );
  console.log(
    "Public error locale checks passed (HTTP language, validation fields, stable codes/references and system notices).",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
