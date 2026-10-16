"use server";

import type {
  ClockRequest,
  ClosePosRegisterRequest,
  ClosePosRegisterResult,
  OpenPosRegisterRequest,
  PosRegisterState,
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

export async function openRegisterAction(
  input: OpenPosRegisterRequest,
): Promise<ShiftActionResult<PosRegisterState>> {
  const result = await run(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.staff.openRegister(input, options);
  });
  if (result.ok) {
    revalidatePath("/shift-handover");
    revalidatePath("/sale");
  }
  return result;
}

export async function closeRegisterAction(
  input: ClosePosRegisterRequest,
): Promise<ShiftActionResult<ClosePosRegisterResult>> {
  const result = await run(async () => {
    const options = await getPosServerApiRequestOptions();
    return posApi.pos.staff.closeRegister(input, options);
  });
  if (result.ok) {
    revalidatePath("/shift-handover");
    revalidatePath("/sale");
  }
  return result;
}
