import { createLogger, type AppLogger } from "@cleanhub/logger";

import type { MobileAuthContext } from "../auth/auth.types.js";
import { MobileNotificationsRepository } from "./notifications.repository.js";
import type {
  MobileDeviceTokenRegisterInput,
  MobileDeviceTokenUnregisterInput,
  MobileDeviceTokenUnregisterResult,
  MobileDeviceTokenView,
} from "./notifications.types.js";

export type MobileNotificationsServiceOptions = {
  repository?: MobileNotificationsRepository;
  logger?: Pick<AppLogger, "info" | "warn" | "error">;
};

export class MobileNotificationsService {
  private readonly repository: MobileNotificationsRepository;
  private readonly logger: Pick<AppLogger, "info" | "warn" | "error">;

  constructor(options: MobileNotificationsServiceOptions = {}) {
    this.repository = options.repository ?? new MobileNotificationsRepository();
    this.logger =
      options.logger ??
      createLogger({ name: "mobile-notifications", service: "cleanhub-api" });
  }

  async registerDeviceToken(
    context: MobileAuthContext,
    input: MobileDeviceTokenRegisterInput,
  ): Promise<MobileDeviceTokenView> {
    const now = new Date();
    const row = await this.repository.upsertDeviceToken({
      tenantId: context.tenantId,
      subjectType: context.subjectType,
      subjectId: context.subjectId,
      token: input.token,
      platform: input.platform,
      deviceId: input.deviceId ?? null,
      locale: input.locale ?? null,
      now,
    });

    this.logger.info(
      {
        tenantId: context.tenantId,
        subjectType: context.subjectType,
        subjectId: context.subjectId,
        pushTokenId: row.id,
        platform: row.platform,
      },
      "Mobile push token registered",
    );

    return {
      id: row.id,
      platform: row.platform,
      deviceId: row.deviceId,
      locale: row.locale,
      lastSeenAt: row.lastSeenAt.toISOString(),
    };
  }

  async unregisterDeviceToken(
    context: MobileAuthContext,
    input: MobileDeviceTokenUnregisterInput,
  ): Promise<MobileDeviceTokenUnregisterResult> {
    const removed = await this.repository.softDeleteDeviceToken({
      tenantId: context.tenantId,
      subjectType: context.subjectType,
      subjectId: context.subjectId,
      token: input.token,
      now: new Date(),
    });

    this.logger.info(
      {
        tenantId: context.tenantId,
        subjectType: context.subjectType,
        subjectId: context.subjectId,
        removed,
      },
      "Mobile push token unregistered",
    );

    return { removed };
  }
}
