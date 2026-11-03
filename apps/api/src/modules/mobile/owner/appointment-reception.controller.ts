import type { Context } from "hono";
import { z } from "zod";
import type { AppBindings } from "../../../http/types.js";
import { AuthError } from "../../auth/auth.errors.js";
import { receiveCustomerAppointment } from "./appointment-reception.service.js";

export async function receiveAppointmentController(c: Context<AppBindings>) {
  const auth = c.get("mobileAuthContext");
  if (auth.subjectType !== "staff" || auth.role !== "owner")
    throw new AuthError("FORBIDDEN", "Owner access is required.");
  const { appointmentId } = z
    .object({ appointmentId: z.string().length(26) })
    .parse(c.req.param());
  const { ticketType } = z
    .object({ ticketType: z.enum(["laundry", "car_wash"]) })
    .strict()
    .parse(await c.req.json());
  return c.json(
    await receiveCustomerAppointment(
      { ...auth, role: "owner", userId: auth.subjectId },
      appointmentId,
      ticketType,
    ),
  );
}
