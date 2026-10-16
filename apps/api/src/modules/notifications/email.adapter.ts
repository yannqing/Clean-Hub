import nodemailer, { type Transporter } from "nodemailer";

import type { ChannelAdapter, ChannelSendInput, ChannelSendResult } from "./channel-adapter.js";
import type { EmailConfig } from "./email-config.js";

export class EmailAdapter implements ChannelAdapter {
  readonly channel = "email" as const;
  private readonly transporter: Transporter;

  constructor(private readonly config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPass ?? "",
          }
        : undefined,
    });
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return {
      externalId: info.messageId,
      status: "sent",
    };
  }
}
