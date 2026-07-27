export type TenantPosChannelErrorCode =
  | "POS_CHANNEL_BRANCH_NOT_FOUND"
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
