import { isUlid } from "@cleanhub/id";

import type {
  CreateHardwareConfigRequest,
  HardwareConnectionType,
  HardwareDeviceStatus,
  HardwareDeviceType,
  UpdateHardwareConfigRequest,
} from "@cleanhub/api-client";

/**
 * Hardware device form validators.
 *
 * These mirror the backend zod schemas in
 * `apps/api/src/modules/tenant/hardware/hardware.validation.ts` so device
 * binding/edit forms can fail fast on the client. Error keys match the form
 * field names (`branchId`, `name`, `deviceType`, `connectionType`, `status`).
 */

const DEVICE_TYPES: readonly HardwareDeviceType[] = [
  "printer",
  "scanner",
  "cash_drawer",
];

const CONNECTION_TYPES: readonly HardwareConnectionType[] = [
  "usb",
  "bluetooth",
  "network",
  "other",
];

const DEVICE_STATUSES: readonly HardwareDeviceStatus[] = [
  "active",
  "inactive",
];

type DeviceFormField =
  | "branchId"
  | "name"
  | "deviceType"
  | "connectionType"
  | "status"
  | "version";

type DeviceFormErrors = Partial<Record<DeviceFormField, string>>;

type ValidationResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; errors: DeviceFormErrors };

/**
 * Validate the bind-device form. `branchId` must be a valid ULID, `name` is
 * required (≤ 200 chars), and the type/connection enums must be in range.
 */
export function validateCreateDeviceForm(
  input: CreateHardwareConfigRequest,
): ValidationResult<CreateHardwareConfigRequest> {
  const errors: DeviceFormErrors = {};
  const name = input.name.trim();

  if (!isUlid(input.branchId)) {
    errors.branchId = "Select a valid branch.";
  }

  if (!name) {
    errors.name = "Device name is required.";
  } else if (name.length > 200) {
    errors.name = "Device name must be 200 characters or fewer.";
  }

  if (!DEVICE_TYPES.includes(input.deviceType)) {
    errors.deviceType = "Choose a supported device type.";
  }

  if (!CONNECTION_TYPES.includes(input.connectionType)) {
    errors.connectionType = "Choose a supported connection type.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      branchId: input.branchId,
      name,
      deviceType: input.deviceType,
      connectionType: input.connectionType,
      config: input.config,
    },
  };
}

/**
 * Validate the edit-device form. All fields are optional, but the backend
 * rejects an empty update, so at least one field must be present. Provided
 * values are checked against the same rules as the create form.
 */
export function validateUpdateDeviceForm(
  input: UpdateHardwareConfigRequest,
): ValidationResult<UpdateHardwareConfigRequest> {
  const errors: DeviceFormErrors = {};

  if (!Number.isInteger(input.version) || input.version < 1) {
    errors.version = "Device version is required. Refresh and try again.";
  }

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      errors.name = "Device name cannot be empty.";
    } else if (name.length > 200) {
      errors.name = "Device name must be 200 characters or fewer.";
    }
  }

  if (
    input.branchId !== undefined &&
    !isUlid(input.branchId)
  ) {
    errors.branchId = "Select a valid branch.";
  }

  if (
    input.connectionType !== undefined &&
    !CONNECTION_TYPES.includes(input.connectionType)
  ) {
    errors.connectionType = "Choose a supported connection type.";
  }

  if (
    input.status !== undefined &&
    !DEVICE_STATUSES.includes(input.status)
  ) {
    errors.status = "Choose a supported status.";
  }

  const hasField = (
    ["name", "branchId", "connectionType", "status", "config"] as const
  ).some((key) => input[key] !== undefined);

  if (!hasField && Object.keys(errors).length === 0) {
    return {
      ok: false,
      errors: { name: "Update at least one field." },
    };
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const data: UpdateHardwareConfigRequest = { version: input.version };

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }

  if (input.branchId !== undefined) {
    data.branchId = input.branchId;
  }

  if (input.connectionType !== undefined) {
    data.connectionType = input.connectionType;
  }

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.config !== undefined) {
    data.config = input.config;
  }

  return { ok: true, data };
}
