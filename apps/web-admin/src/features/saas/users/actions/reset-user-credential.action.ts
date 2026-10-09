import { webAdminApi } from "@/lib/api-client";

export async function resetUserCredentialAction(
  userId: string,
  credential: "password" | "pin",
  reason: string,
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length > 500) {
    return {
      ok: false as const,
      error: "A reason between 1 and 500 characters is required.",
    };
  }
  try {
    const result =
      credential === "pin"
        ? await webAdminApi.saas.users.resetDirectoryPin(userId, {
            reason: trimmedReason,
          })
        : await webAdminApi.saas.users.resetDirectoryPassword(userId, {
            reason: trimmedReason,
          });
    return {
      ok: true as const,
      value:
        "temporaryPin" in result
          ? result.temporaryPin
          : result.temporaryPassword,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not reset user credentials.",
    };
  }
}
