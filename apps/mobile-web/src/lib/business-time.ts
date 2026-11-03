import { resolveTimeZone } from "@cleanhub/domain/timezone";

let businessTimeZone = "UTC";
export function setBusinessTimeZone(zone?: string) {
  businessTimeZone = resolveTimeZone(zone);
}
export function getBusinessTimeZone() {
  return businessTimeZone;
}
