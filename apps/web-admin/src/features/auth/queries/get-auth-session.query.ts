import { getCurrentUser } from "@/lib/auth";

export async function getAuthSessionQuery() {
  return getCurrentUser();
}
