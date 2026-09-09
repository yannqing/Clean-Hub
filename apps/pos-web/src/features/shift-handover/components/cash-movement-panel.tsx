"use client";

import type {
  PosRegisterState,
  PosShiftCashMovement,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

function movementNet(movements: PosShiftCashMovement[]): number {
  return movements.reduce(
    (total, movement) =>
      total +
      (movement.movementType === "pay_in"
        ? Number(movement.amount)
        : -Number(movement.amount)),
    0,
  );
}

export function CashMovementPanel({
  canManage,
  register,
}: {
  canManage: boolean;
  register: PosRegisterState;
}) {
  const router = useRouter();
  const [movements, setMovements] = useState<PosShiftCashMovement[]>([]);
  const [movementType, setMovementType] = useState<"pay_in" | "pay_out">(
    "pay_in",
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const publish = useCallback((next: PosShiftCashMovement[]) => {
    setMovements(next);
  }, []);

  useEffect(() => {
    void posApi.pos.staff
      .listCurrentRegisterCashMovements()
      .then((result) => publish(result.data))
      .catch((error) => toast.error(getPosApiErrorMessage(error)));
  }, [publish, register]);

  async function submit() {
    if (Number(amount) <= 0 || reason.trim().length < 3) {
      toast.error("请输入有效金额，并填写至少 3 个字符的原因。");
      return;
    }
    setSubmitting(true);
    try {
      const created = await posApi.pos.staff.createRegisterCashMovement({
        movementType,
        amount: Number(amount).toFixed(2),
        reason: reason.trim(),
        idempotencyKey: createId(),
      });
      publish([...movements, created]);
      router.refresh();
      setAmount("");
      setReason("");
      toast.success(
        movementType === "pay_in" ? "现金入柜已记录。" : "现金出柜已记录。",
      );
    } catch (error) {
      toast.error(getPosApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border-y bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">非销售现金进出</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            零钞补充、备用金提取等操作会计入交班应有现金，并保留原因和审计。
          </p>
        </div>
        <span className="text-sm font-semibold">
          净额 {movementNet(movements).toFixed(2)} {register.cashSession?.currency}
        </span>
      </div>
      {canManage && register.cashSession?.status === "open" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[130px_140px_1fr_auto]">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(event) =>
              setMovementType(event.target.value as "pay_in" | "pay_out")
            }
            value={movementType}
          >
            <option value="pay_in">现金入柜</option>
            <option value="pay_out">现金出柜</option>
          </select>
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="金额"
            value={amount}
          />
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="原因，例如：补充零钞"
            value={reason}
          />
          <button
            className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? "记录中…" : "记录"}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
          {!canManage
            ? "只有店长或管理员可以登记非销售现金进出。"
            : "请先开启可跟踪的钱箱会话，再登记现金进出。"}
        </p>
      )}
      {movements.length > 0 ? (
        <div className="mt-4 divide-y border-t">
          {movements.map((movement) => (
            <div
              className="flex items-start justify-between gap-3 py-3 text-sm"
              key={movement.id}
            >
              <div>
                <p className="font-medium">
                  {movement.movementType === "pay_in" ? "现金入柜" : "现金出柜"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {movement.reason}
                </p>
              </div>
              <span
                className={
                  movement.movementType === "pay_in"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-600"
                }
              >
                {movement.movementType === "pay_in" ? "+" : "-"}
                {movement.amount} {movement.currency}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
