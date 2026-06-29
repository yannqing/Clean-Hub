import type { NotificationChannel } from "./notifications.types.js";

export type ChannelSendInput = {
  deliveryId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type ChannelSendResult = {
  externalId: string;
  status: "sent";
};

export type ChannelAdapter = {
  channel: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
};
