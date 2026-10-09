import type { NotificationChannel } from "./notifications.types.js";

export type ChannelSendInput = {
  deliveryId: string;
  /** Email address for the email channel, FCM device token for the push channel. */
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Push-only key/value payload delivered to the client for deep-linking. */
  data?: Record<string, string>;
};

export type ChannelSendResult = {
  externalId: string;
  status: "sent";
};

export type ChannelAdapter = {
  channel: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
};
