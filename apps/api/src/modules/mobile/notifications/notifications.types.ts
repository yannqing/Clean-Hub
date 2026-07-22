export type MobilePushPlatform = "android" | "ios" | "web";

export type MobileDeviceTokenRegisterInput = {
  token: string;
  platform: MobilePushPlatform;
  deviceId?: string | null;
  locale?: string | null;
};

export type MobileDeviceTokenUnregisterInput = {
  token: string;
};

export type MobileDeviceTokenView = {
  id: string;
  platform: MobilePushPlatform;
  deviceId: string | null;
  locale: string | null;
  lastSeenAt: string;
};

export type MobileDeviceTokenUnregisterResult = {
  removed: boolean;
};

export type MobileNotificationsErrorCode = "MOBILE_NOTIFICATIONS_VALIDATION_ERROR";

export class MobileNotificationsError extends Error {
  constructor(
    readonly code: MobileNotificationsErrorCode,
    message: string,
    readonly status: 400 | 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MobileNotificationsError";
  }
}
