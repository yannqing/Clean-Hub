"use client";

import {
  Badge,
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  toast,
} from "@cleanhub/ui";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  BranchCashHandlingMode,
  BranchPaymentMethod,
  BranchSummary,
} from "@/features/tenant/branches/types";
import { isLockedPosPaymentMethod } from "@cleanhub/domain/payment-methods";

import { useTenantI18n } from "@/i18n";

import { updateBranchPaymentSettingsAction } from "../actions/update-branch-payment-settings.action";
import { TenantSettingsSurface } from "./tenant-settings-surface";
import { useTenantSettingsWorkspace } from "./tenant-settings-workspace";

export type BranchPaymentSection = "payments" | "cash";

const PAYMENT_METHODS: readonly BranchPaymentMethod[] = ["cash", "card", "app"];
const CASH_HANDLING_MODES: readonly BranchCashHandlingMode[] = [
  "none",
  "untracked",
  "shared_drawer",
  "cash_in_hand",
];

type Copy = {
  paymentsTitle: string;
  paymentsDescription: string;
  cashTitle: string;
  cashDescription: string;
  branchLabel: string;
  branchHint: string;
  noBranches: string;
  inactive: string;
  methodsTitle: string;
  methodsHint: string;
  methods: Record<BranchPaymentMethod, string>;
  methodNotes: Record<BranchPaymentMethod, string>;
  mobileMoneyBlocked: string;
  defaultMethod: string;
  defaultMethodHint: string;
  cashModeLabel: string;
  cashModeHint: string;
  cashRoundingLabel: string;
  cashRoundingHint: string;
  cashRoundingOff: string;
  cashRoundingNote: (step: number) => string;
  cashModes: Record<BranchCashHandlingMode, string>;
  cashModeDescriptions: Record<BranchCashHandlingMode, string>;
  cashDisabled: string;
  save: string;
  saving: string;
  saved: string;
  readOnly: string;
  loadError: string;
};

const copy: Record<"en" | "fr" | "zh-CN", Copy> = {
  en: {
    paymentsTitle: "Payment methods",
    paymentsDescription:
      "Choose how this branch can be paid. Every POS terminal in the branch follows these rules.",
    cashTitle: "Cash handling",
    cashDescription:
      "Decide whether this branch counts cash, and who is responsible for it.",
    branchLabel: "Branch",
    branchHint: "Each branch can accept different payment methods.",
    noBranches: "No accessible branches are available.",
    inactive: "Inactive",
    methodsTitle: "Accepted payment methods",
    methodsHint:
      "Disabled methods never appear at checkout. Mobile money also requires a verified provider under Payments.",
    methods: { cash: "Cash", card: "Card", app: "Mobile money" },
    methodNotes: {
      cash: "Counted at the register according to the cash handling mode.",
      card: "Locked. The in-store terminal has no certified card reader, so card cannot be accepted yet.",
      app: "The customer transfers from their phone and the cashier records the transaction reference.",
    },
    mobileMoneyBlocked:
      "Connect and verify Wave or Orange Money below, then enable it for POS, before this method can be used.",
    defaultMethod: "Default payment method",
    defaultMethodHint: "Pre-selected at checkout. It must also be enabled.",
    cashModeLabel: "Cash handling mode",
    cashModeHint: "Enable cash first to choose how the branch handles it.",
    cashRoundingLabel: "Smallest cash note",
    cashRoundingHint:
      "The smallest note or coin this till stocks. Cashiers can offer to round a cash total down to it; card and mobile payments are always exact.",
    cashRoundingOff: "No rounding (exact amounts)",
    cashRoundingNote: (step) =>
      `Cashiers may round cash down to a multiple of ${step}. The difference is recorded on the order.`,
    cashModes: {
      none: "No cash accepted",
      untracked: "Accept cash without counting",
      shared_drawer: "One shared drawer",
      cash_in_hand: "Each cashier carries their own cash",
    },
    cashModeDescriptions: {
      none: "Cash is disabled, so no drawer is reconciled.",
      untracked: "Cash is accepted but drawer totals are never reconciled.",
      shared_drawer:
        "Everyone sells from one drawer and it is counted once at close.",
      cash_in_hand:
        "Each cashier counts their own cash; a manager closes the register once all are counted.",
    },
    cashDisabled: "Cash is not enabled for this branch.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Settings saved.",
    readOnly: "Read only",
    loadError: "Settings could not be updated.",
  },
  fr: {
    paymentsTitle: "Moyens de paiement",
    paymentsDescription:
      "Choisissez comment cette succursale peut être payée. Tous ses terminaux suivent ces règles.",
    cashTitle: "Gestion des espèces",
    cashDescription:
      "Décidez si cette succursale compte les espèces et qui en est responsable.",
    branchLabel: "Succursale",
    branchHint:
      "Chaque succursale peut accepter des moyens de paiement différents.",
    noBranches: "Aucune succursale accessible.",
    inactive: "Inactive",
    methodsTitle: "Moyens de paiement acceptés",
    methodsHint:
      "Les moyens désactivés n'apparaissent jamais à l'encaissement. Le paiement mobile exige aussi un fournisseur vérifié.",
    methods: { cash: "Espèces", card: "Carte", app: "Paiement mobile" },
    methodNotes: {
      cash: "Comptées en caisse selon le mode de gestion des espèces.",
      card: "Verrouillé. Le terminal en magasin n'a pas de lecteur de carte certifié : la carte ne peut pas encore être acceptée.",
      app: "Le client paie depuis son téléphone et le caissier saisit la référence de la transaction.",
    },
    mobileMoneyBlocked:
      "Connectez et vérifiez Wave ou Orange Money ci-dessous, puis activez-le pour le POS, avant de pouvoir utiliser ce moyen.",
    defaultMethod: "Moyen de paiement par défaut",
    defaultMethodHint:
      "Présélectionné à l'encaissement. Il doit aussi être activé.",
    cashRoundingLabel: "Plus petite coupure",
    cashRoundingHint:
      "La plus petite pièce ou coupure de cette caisse. Le caissier peut proposer d'arrondir un total en espèces à l'inférieur ; les paiements par carte et mobile restent exacts.",
    cashRoundingOff: "Aucun arrondi (montants exacts)",
    cashRoundingNote: (step) =>
      `Le caissier peut arrondir les espèces à un multiple de ${step}. L'écart est enregistré sur la commande.`,
    cashModeLabel: "Mode de gestion des espèces",
    cashModeHint:
      "Activez d'abord les espèces pour choisir leur mode de gestion.",
    cashModes: {
      none: "Pas d'espèces",
      untracked: "Accepter les espèces sans comptage",
      shared_drawer: "Un tiroir partagé",
      cash_in_hand: "Chaque caissier garde ses espèces",
    },
    cashModeDescriptions: {
      none: "Les espèces sont désactivées, aucun tiroir n'est rapproché.",
      untracked:
        "Les espèces sont acceptées mais les totaux ne sont jamais rapprochés.",
      shared_drawer:
        "Tout le monde vend depuis un tiroir, compté une fois à la clôture.",
      cash_in_hand:
        "Chaque caissier compte ses espèces ; un responsable clôture la caisse ensuite.",
    },
    cashDisabled: "Les espèces ne sont pas activées pour cette succursale.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Paramètres enregistrés.",
    readOnly: "Lecture seule",
    loadError: "Les paramètres n'ont pas pu être mis à jour.",
  },
  "zh-CN": {
    paymentsTitle: "支付方式",
    paymentsDescription:
      "设置本门店可以收哪些款。门店下所有收银终端都遵循这里的规则。",
    cashTitle: "现金管理",
    cashDescription: "设置本门店是否盘点现金，以及由谁负责保管。",
    branchLabel: "门店",
    branchHint: "每家门店可以启用不同的支付方式。",
    noBranches: "暂无可管理的门店。",
    inactive: "已停用",
    methodsTitle: "启用的支付方式",
    methodsHint:
      "未启用的方式不会出现在结账页；移动支付还需要先在「支付」中完成渠道验证。",
    methods: { cash: "现金", card: "刷卡", app: "移动支付" },
    methodNotes: {
      cash: "按门店的现金处理方式在收银台盘点。",
      card: "已锁定。店内终端没有通过认证的读卡设备，暂时无法受理刷卡。",
      app: "顾客用手机转账，收银员在 POS 中录入交易参考号。",
    },
    mobileMoneyBlocked:
      "请先在下方绑定并验证 Wave 或 Orange Money，并开启 POS 使用，之后才能启用移动支付。",
    defaultMethod: "默认支付方式",
    defaultMethodHint: "结账时预选的方式，必须同时处于启用状态。",
    cashModeLabel: "现金处理方式",
    cashModeHint: "请先启用现金，再选择本门店的现金处理方式。",
    cashRoundingLabel: "最小现金面额",
    cashRoundingHint:
      "本店钱箱能找开的最小面额。收银员可以选择把现金金额抹零到该面额；刷卡和移动支付始终按原价收取。",
    cashRoundingOff: "不抹零（按原价收取）",
    cashRoundingNote: (step) =>
      `收银员可将现金抹零到 ${step} 的倍数，差额会记录在订单上。`,
    cashModes: {
      none: "不收现金",
      untracked: "收现金但不盘点",
      shared_drawer: "多人共用一个钱箱",
      cash_in_hand: "店员各自保管随身现金",
    },
    cashModeDescriptions: {
      none: "本门店不收现金，无需对账钱箱。",
      untracked: "收现金，但不核对钱箱金额，关台时不做现金对账。",
      shared_drawer: "所有人共用一个钱箱，关台时统一盘点一次。",
      cash_in_hand:
        "每位收银员各自盘点自己的现金；全部盘完后由店长或管理员关台。",
    },
    cashDisabled: "本门店未启用现金支付。",
    save: "保存修改",
    saving: "保存中…",
    saved: "设置已保存。",
    readOnly: "只读",
    loadError: "设置保存失败。",
  },
};

type EditableSettings = {
  paymentMethodsEnabled: BranchPaymentMethod[];
  defaultPaymentMethod: BranchPaymentMethod;
  cashHandlingMode: BranchCashHandlingMode;
  cashRoundingStep: number;
};

/** Note sizes a till realistically stocks; 1 means no rounding is offered. */
const CASH_ROUNDING_STEPS = [1, 5, 10, 25, 50, 100] as const;

function toEditableSettings(branch: BranchSummary): EditableSettings {
  return {
    paymentMethodsEnabled: [...branch.paymentMethodsEnabled],
    defaultPaymentMethod: branch.defaultPaymentMethod,
    cashHandlingMode: branch.cashHandlingMode,
    cashRoundingStep: branch.cashRoundingStep,
  };
}

export function BranchPaymentSettingsView({
  initialBranches,
  initialError,
  mobileMoneyReady = false,
  section,
}: {
  initialBranches?: BranchSummary[];
  initialError?: string;
  /**
   * True only when a provider is verified and enabled for POS. The API drops
   * "app" from a terminal's methods otherwise, so offering the checkbox would
   * promise a method the register can never show.
   */
  mobileMoneyReady?: boolean;
  section: BranchPaymentSection;
}) {
  const { locale } = useTenantI18n();
  const text = copy[locale];
  const { authLoaded, canUpdateSettings } = useTenantSettingsWorkspace();
  const [branches, setBranches] = useState(initialBranches ?? []);
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialBranches?.[0]?.id ?? "",
  );
  const [saving, setSaving] = useState(false);
  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );
  const [form, setForm] = useState<EditableSettings | null>(() =>
    initialBranches?.[0] ? toEditableSettings(initialBranches[0]) : null,
  );

  const cashEnabled = Boolean(form?.paymentMethodsEnabled.includes("cash"));

  function selectBranch(branchId: string) {
    const branch = branches.find((candidate) => candidate.id === branchId);
    setSelectedBranchId(branchId);
    setForm(branch ? toEditableSettings(branch) : null);
  }

  function toggleMethod(method: BranchPaymentMethod, checked: boolean) {
    if (!form) return;
    if (checked && isLockedPosPaymentMethod(method)) return;

    const selected = checked
      ? [...form.paymentMethodsEnabled, method]
      : form.paymentMethodsEnabled.filter((candidate) => candidate !== method);
    if (selected.length === 0) return;

    const methods = PAYMENT_METHODS.filter((candidate) =>
      selected.includes(candidate),
    );
    setForm({
      ...form,
      paymentMethodsEnabled: methods,
      // Keep the default method and the cash mode consistent with what is
      // still enabled, so the form can never submit a rejected combination.
      defaultPaymentMethod: methods.includes(form.defaultPaymentMethod)
        ? form.defaultPaymentMethod
        : methods[0]!,
      cashHandlingMode: methods.includes("cash")
        ? form.cashHandlingMode === "none"
          ? "shared_drawer"
          : form.cashHandlingMode
        : "none",
    });
  }

  async function save() {
    if (!selectedBranch || !form) return;
    setSaving(true);

    try {
      const result = await updateBranchPaymentSettingsAction({
        branchId: selectedBranch.id,
        version: selectedBranch.version,
        paymentMethodsEnabled: form.paymentMethodsEnabled,
        defaultPaymentMethod: form.defaultPaymentMethod,
        cashHandlingMode: form.cashHandlingMode,
        cashRoundingStep: form.cashRoundingStep,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setBranches((current) =>
        current.map((branch) =>
          branch.id === result.data.id ? result.data : branch,
        ),
      );
      setForm(toEditableSettings(result.data));
      toast.success(text.saved);
    } catch {
      toast.error(text.loadError);
    } finally {
      setSaving(false);
    }
  }

  const isCash = section === "cash";

  return (
    <TenantSettingsSurface>
      <header className="flex flex-col gap-4 border-b border-black/10 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {isCash ? text.cashTitle : text.paymentsTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            {isCash ? text.cashDescription : text.paymentsDescription}
          </p>
        </div>
        {canUpdateSettings && selectedBranch ? (
          <Button
            className="shrink-0 gap-2"
            disabled={saving || !authLoaded}
            onClick={save}
            size="sm"
            type="button"
          >
            <Save aria-hidden className="size-4" />
            {saving ? text.saving : text.save}
          </Button>
        ) : (
          <Badge className="w-fit shrink-0" variant="outline">
            {text.readOnly}
          </Badge>
        )}
      </header>

      {initialError ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-5">
          {initialError}
        </div>
      ) : null}

      <section className="border-b border-black/10 px-4 py-5 sm:px-5">
        <div className="max-w-xl space-y-2">
          <Label htmlFor="branch-payment-settings-branch">
            {text.branchLabel}
          </Label>
          <Select
            disabled={branches.length === 0 || saving}
            onValueChange={selectBranch}
            value={selectedBranchId}
          >
            <SelectTrigger id="branch-payment-settings-branch">
              <SelectValue placeholder={text.noBranches} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.status === "inactive" ? ` · ${text.inactive}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-5 text-slate-500">{text.branchHint}</p>
        </div>
      </section>

      {!selectedBranch || !form ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">
          {text.noBranches}
        </div>
      ) : isCash ? (
        <section className="space-y-3 px-4 py-5 sm:px-5">
          <div className="max-w-xl space-y-2">
            <Label htmlFor="branch-cash-mode">{text.cashModeLabel}</Label>
            <Select
              disabled={!canUpdateSettings || saving || !cashEnabled}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  cashHandlingMode: value as BranchCashHandlingMode,
                })
              }
              value={form.cashHandlingMode}
            >
              <SelectTrigger id="branch-cash-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASH_HANDLING_MODES.filter(
                  (mode) => cashEnabled || mode === "none",
                ).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {text.cashModes[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              {cashEnabled
                ? text.cashModeDescriptions[form.cashHandlingMode]
                : `${text.cashDisabled} ${text.cashModeHint}`}
            </p>
          </div>

          <div className="max-w-xl space-y-2">
            <Label htmlFor="branch-cash-rounding">
              {text.cashRoundingLabel}
            </Label>
            <Select
              disabled={!canUpdateSettings || saving || !cashEnabled}
              onValueChange={(value) =>
                setForm({ ...form, cashRoundingStep: Number(value) })
              }
              value={String(form.cashRoundingStep)}
            >
              <SelectTrigger id="branch-cash-rounding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASH_ROUNDING_STEPS.map((step) => (
                  <SelectItem key={step} value={String(step)}>
                    {step === 1 ? text.cashRoundingOff : String(step)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              {form.cashRoundingStep > 1
                ? text.cashRoundingNote(form.cashRoundingStep)
                : text.cashRoundingHint}
            </p>
          </div>
        </section>
      ) : (
        <section className="space-y-6 px-4 py-5 sm:px-5">
          <div className="space-y-2">
            <Label>{text.methodsTitle}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => {
                const enabled = form.paymentMethodsEnabled.includes(method);
                const locked = isLockedPosPaymentMethod(method);
                // Block turning mobile money on without a provider, but never
                // trap a branch that already has it enabled.
                const blocked =
                  locked || (method === "app" && !mobileMoneyReady && !enabled);
                return (
                  <label
                    className={cn(
                      "flex flex-col gap-1 rounded-md border px-3 py-2 text-sm",
                      blocked && "bg-muted/40 text-muted-foreground",
                    )}
                    key={method}
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={enabled}
                        disabled={!canUpdateSettings || saving || blocked}
                        onCheckedChange={(checked) =>
                          toggleMethod(method, checked === true)
                        }
                      />
                      {text.methods[method]}
                    </span>
                    <span className="text-xs leading-5 text-slate-500">
                      {method === "app" && !mobileMoneyReady && !locked
                        ? text.mobileMoneyBlocked
                        : text.methodNotes[method]}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs leading-5 text-slate-500">
              {text.methodsHint}
            </p>
          </div>

          <div className="max-w-xl space-y-2">
            <Label htmlFor="branch-default-payment">{text.defaultMethod}</Label>
            <Select
              disabled={!canUpdateSettings || saving}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  defaultPaymentMethod: value as BranchPaymentMethod,
                })
              }
              value={form.defaultPaymentMethod}
            >
              <SelectTrigger id="branch-default-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {form.paymentMethodsEnabled.map((method) => (
                  <SelectItem key={method} value={method}>
                    {text.methods[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              {text.defaultMethodHint}
            </p>
          </div>
        </section>
      )}
    </TenantSettingsSurface>
  );
}
