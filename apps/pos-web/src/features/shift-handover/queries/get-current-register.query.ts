import "server-only";

import type { PosRegisterState } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getCurrentRegisterQuery(): Promise<PosRegisterState> {
  return posApi.pos.staff.currentRegister(
    await getPosServerApiRequestOptions(),
  );
}
