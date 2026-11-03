import type { Context } from "hono";
import { z } from "zod";
import { getDb } from "@cleanhub/db";
import type { AppBindings } from "../../../http/types.js";
import { AuthError } from "../../auth/auth.errors.js";
import { CustomerError } from "./customer.types.js";
import { findCustomerAppointmentTracking } from "./customer-tracking.repository.js";

export async function customerTrackingController(c: Context<AppBindings>) {
  const auth = c.get("mobileAuthContext");
  if (auth.subjectType !== "customer")
    throw new AuthError("FORBIDDEN", "Customer access is required.");
  const id = z.string().length(26).parse(c.req.param("id"));
  const result = await findCustomerAppointmentTracking(getDb(), {
    tenantId: auth.tenantId,
    customerAccountId: auth.subjectId,
    appointmentId: id,
  });
  if (!result)
    throw new CustomerError(
      "CUSTOMER_APPOINTMENT_NOT_FOUND",
      "Appointment was not found.",
      404,
    );
  return c.json(result);
}
