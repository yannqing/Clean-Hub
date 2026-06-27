import type { ApiClient } from "../types";
import { createMobileAuthApi } from "./auth";
import { createMobileCustomerApi } from "./customer";
import { createMobileDeliveryApi } from "./delivery";
import { createMobileOwnerApi } from "./owner";

export * from "./auth";
export * from "./auth.types";
export * from "./customer";
export * from "./customer.types";
export * from "./delivery";
export * from "./delivery.types";
export * from "./owner";
export * from "./owner.types";

export function createMobileApi(client: ApiClient) {
  return {
    auth: createMobileAuthApi(client),
    customer: createMobileCustomerApi(client),
    delivery: createMobileDeliveryApi(client),
    owner: createMobileOwnerApi(client),
  };
}
