import type { ApiClient } from "../types";
import { createMobileAuthApi } from "./auth";
import { createMobileCustomerApi } from "./customer";
import { createMobileDeliveryApi } from "./delivery";
import { createMobileMediaApi } from "./media";
import { createMobileOwnerApi } from "./owner";
import { createMobilePaymentApi } from "./payment";

export * from "./auth";
export * from "./auth.types";
export * from "./customer";
export * from "./customer.types";
export * from "./delivery";
export * from "./delivery.types";
export * from "./media";
export * from "./media.types";
export * from "./owner";
export * from "./owner.types";
export * from "./payment";
export * from "./payment.types";

export function createMobileApi(client: ApiClient) {
  return {
    auth: createMobileAuthApi(client),
    customer: createMobileCustomerApi(client),
    delivery: createMobileDeliveryApi(client),
    media: createMobileMediaApi(client),
    owner: createMobileOwnerApi(client),
    payment: createMobilePaymentApi(client),
  };
}
