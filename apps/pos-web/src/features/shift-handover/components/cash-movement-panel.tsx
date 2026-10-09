"use client";

import type {
  PosRegisterState,
  PosShiftCashMovement,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { createId } from "@cleanhub/id";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { formatPosMoney } from "@/lib/money";
import { posToast as toast } from "@/lib/pos-toast";

type Locale = "zh-CN" | "en" | "fr";

const COPY = {
  "zh-CN": {
    title: "非销售现金进出",
    description:
      "零钞补充、备用金提取等操作会计入交班应有现金，并保留原因和审计。",
    net: "净额",
    payIn: "现金入柜",
    payOut: "现金出柜",
    amount: "金额",
    reasonPlaceholder: "原因，例如：补充零钞",
    record: "记录",
    recording: "记录中…",
    invalidInput: "请输入有效金额，并填写至少 3 个字符的原因。",
    payInRecorded: "现金入柜已记录。",
    payOutRecorded: "现金出柜已记录。",
    managerOnly: "只有店长或管理员可以登记非销售现金进出。",
    sessionRequired: "请先开启可跟踪的钱箱会话，再登记现金进出。",
  },
  en: {
    title: "Non-sale cash movements",
    description:
      "Float top-ups and petty cash withdrawals count towards the expected cash at handover, and keep a reason and an audit trail.",
    net: "Net",
    payIn: "Cash in",
    payOut: "Cash out",
    amount: "Amount",
    reasonPlaceholder: "Reason, e.g. topping up small change",
    record: "Record",
    recording: "Recording...",
    invalidInput: "Enter a valid amount and a reason of at least 3 characters.",
    payInRecorded: "Cash in recorded.",
    payOutRecorded: "Cash out recorded.",
    managerOnly: "Only an owner or manager can record non-sale cash movements.",
    sessionRequired:
      "Open a tracked cash session before recording cash movements.",
  },
  fr: {
    title: "Mouvements d'espèces hors vente",
    description:
      "Les appoints de monnaie et retraits de petite caisse comptent dans les espèces attendues à la remise, avec motif et piste d'audit.",
    net: "Net",
    payIn: "Entrée d'espèces",
    payOut: "Sortie d'espèces",
    amount: "Montant",
    reasonPlaceholder: "Motif, par exemple : appoint de monnaie",
    record: "Enregistrer",
    recording: "Enregistrement...",
    invalidInput:
      "Saisissez un montant valide et un motif d'au moins 3 caractères.",
    payInRecorded: "Entrée d'espèces enregistrée.",
    payOutRecorded: "Sortie d'espèces enregistrée.",
    managerOnly:
      "Seul un propriétaire ou un responsable peut enregistrer ces mouvements.",
    sessionRequired:
      "Ouvrez une session d'espèces suivie avant d'enregistrer des mouvements.",
  },
} satisfies Record<Locale, Record<string, string>>;

function resolveLocale(locale: string): Locale {
  return locale === "en" || locale === "fr" ? locale : "zh-CN";
}

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
  const { locale } = useTranslation();
  const copy = COPY[resolveLocale(locale)];
  const currency = register.cashSession?.currency;
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
      toast.error(copy.invalidInput);
      return;
    }
    setSubmitting(true);
    try {
      const created = await posApi.pos.staff.createRegisterCashMovement({
        movementType,
        // Sent as typed, not padded to two decimals: a zero-decimal currency
        // has no centimes to pad with, and the server both normalises the
        // stored scale and rejects an amount the drawer could not hold.
        amount: amount.trim(),
        reason: reason.trim(),
        idempotencyKey: createId(),
      });
      publish([...movements, created]);
      router.refresh();
      setAmount("");
      setReason("");
      toast.success(
        movementType === "pay_in" ? copy.payInRecorded : copy.payOutRecorded,
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
          <h2 className="text-sm font-semibold">{copy.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <span className="text-sm font-semibold">
          {copy.net} {formatPosMoney(movementNet(movements), currency, locale)}
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
            <option value="pay_in">{copy.payIn}</option>
            <option value="pay_out">{copy.payOut}</option>
          </select>
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder={copy.amount}
            value={amount}
          />
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.reasonPlaceholder}
            value={reason}
          />
          <button
            className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? copy.recording : copy.record}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
          {!canManage ? copy.managerOnly : copy.sessionRequired}
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
                  {movement.movementType === "pay_in"
                    ? copy.payIn
                    : copy.payOut}
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
                {formatPosMoney(movement.amount, movement.currency, locale)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
