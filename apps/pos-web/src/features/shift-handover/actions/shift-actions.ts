"use server";

import type {
  ClockRequest,
  CreateHandoverRequest,
  HandoverRecord,
  ShiftRecord,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

type ShiftActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function run<T>(task: () => Promise<T>): Promise<ShiftActionResult<T>> {
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "操作失败，请稍后重试。",
    };
  }
}

export async function clockShiftAction(
  input: ClockRequest,
): Promise<ShiftActionResult<ShiftRecord>> {
  const result = await run(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.staff.clock(input, options);
  });
  if (result.ok) revalidatePath("/shift-handover");
  return result;
}

export async function createShiftHandoverAction(
  input: CreateHandoverRequest,
): Promise<ShiftActionResult<HandoverRecord>> {
  const result = await run(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.staff.createHandover(input, options);
  });
  if (result.ok) revalidatePath("/shift-handover");
  return result;
}
