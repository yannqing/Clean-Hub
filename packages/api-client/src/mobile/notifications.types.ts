export type MobilePushPlatform = "android" | "ios" | "web";

export type MobileRegisterDeviceTokenRequest = {
  token: string;
  platform: MobilePushPlatform;
  deviceId?: string | null;
  locale?: string | null;
};

export type MobileDeviceTokenView = {
  id: string;
  platform: MobilePushPlatform;
  deviceId: string | null;
  locale: string | null;
  lastSeenAt: string;
};

export type MobileUnregisterDeviceTokenRequest = {
  token: string;
};

export type MobileUnregisterDeviceTokenResponse = {
  removed: boolean;
};
