import { apiClient } from "@/lib/api-client";

export async function getCurrentMobileAuth() {
  return apiClient.mobile.auth.me();
}
