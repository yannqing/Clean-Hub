/**
 * POS terminal authentication — service layer (Scaffold).
 *
 * PIN login, device binding, and terminal lock state. All methods throw
 * PosNotImplementedError. Note: the platform-wide password login / refresh /
 * logout live in modules/auth/ — this module only covers POS-terminal-specific
 * flows layered on top of an existing session.
 */
import type {
  BindPosDeviceInput,
  GetPosDeviceInput,
  PosDevice,
  PosPinLoginInput,
  PosPinLoginResult,
  PosTerminalState,
  SetTerminalLockInput,
} from "./auth.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function posPinLogin(
  _input: PosPinLoginInput,
): Promise<PosPinLoginResult> {
  throw new PosNotImplementedError("posPinLogin");
}

export async function bindPosDevice(
  _input: BindPosDeviceInput,
): Promise<PosDevice> {
  throw new PosNotImplementedError("bindPosDevice");
}

export async function getPosDevice(
  _input: GetPosDeviceInput,
): Promise<PosDevice> {
  throw new PosNotImplementedError("getPosDevice");
}

export async function setTerminalLock(
  _input: SetTerminalLockInput,
): Promise<PosTerminalState> {
  throw new PosNotImplementedError("setTerminalLock");
}

export async function getTerminalState(
  _input: GetPosDeviceInput,
): Promise<PosTerminalState> {
  throw new PosNotImplementedError("getTerminalState");
}
