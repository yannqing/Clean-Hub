import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listPosHardwareDevices } from "./hardware.service.js";

/**
 * GET /pos/hardware-devices
 *
 * Returns the list of active hardware devices for the current POS user's
 * branch. Read-only — POS terminals cannot create/update/delete devices.
 */
export async function listHardwareDevicesController(
  c: Context<AppBindings>,
) {
  const devices = await listPosHardwareDevices(c.get("authContext"));
  return c.json({ data: devices });
}
