export type TenantPosChannelErrorCode =
  | "MOBILE_MONEY_INTEGRATION_REQUIRED"
  | "POS_CHANNEL_BRANCH_NOT_FOUND"
  | "POS_CHANNEL_DEVICE_BRANCH_INACTIVE"
  | "POS_CHANNEL_DEVICE_CREDENTIAL_REVOKED"
  | "POS_CHANNEL_DEVICE_NOT_FOUND"
  | "POS_CHANNEL_DEVICE_SHIFT_OPEN"
  | "POS_CHANNEL_DEVICE_REGISTER_OPEN"
  | "POS_CHANNEL_DEVICE_VERSION_CONFLICT"
  | "POS_CHANNEL_SETTINGS_CONFLICT"
  | "POS_CHANNEL_SETTINGS_INVALID";

export class TenantPosChannelError extends Error {
  constructor(
    readonly code: TenantPosChannelErrorCode,
    message: string,
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "TenantPosChannelError";
  }
}
