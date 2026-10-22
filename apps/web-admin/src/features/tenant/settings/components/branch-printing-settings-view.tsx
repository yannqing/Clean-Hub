"use client";

import {
  POS_TICKET_LABEL_FIELDS,
  REQUIRED_POS_TICKET_LABEL_FIELDS,
  type PosTicketLabelField,
} from "@cleanhub/domain/receipt";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  toast,
} from "@cleanhub/ui";
import { ReceiptText, Save, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { BranchReceiptFieldsEditor } from "@/features/tenant/branches/components";
import type { BranchSummary } from "@/features/tenant/branches/types";
import { useTenantI18n } from "@/i18n";

import { updateBranchPrintingSettingsAction } from "../actions/update-branch-printing-settings.action";
import { TenantSettingsSurface } from "./tenant-settings-surface";
import { useTenantSettingsWorkspace } from "./tenant-settings-workspace";

type DocumentKey = "salesReceipt" | "ticketLabel";

type Copy = {
  title: string;
  description: string;
  branchLabel: string;
  branchHint: string;
  noBranches: string;
  inactive: string;
  documents: Record<
    DocumentKey,
    { title: string; description: string; badge: string }
  >;
  receiptIdentityTitle: string;
  receiptIdentityDescription: string;
  receiptName: string;
  receiptNamePlaceholder: string;
  receiptPhone: string;
  receiptPhonePlaceholder: string;
  receiptAddress: string;
  receiptAddressPlaceholder: string;
  receiptThankYouMessage: string;
  receiptThankYouMessagePlaceholder: string;
  labelContentTitle: string;
  labelContentDescription: string;
  labelGroups: Record<"identity" | "items" | "service", string>;
  labelFields: Record<PosTicketLabelField, string>;
  required: string;
  save: string;
  saving: string;
  saved: string;
  readOnly: string;
  loadError: string;
};

const copy: Record<"en" | "fr" | "zh-CN", Copy> = {
  en: {
    title: "Printing settings",
    description:
      "Manage every printed document in one place. Rules apply to all POS terminals in the selected branch.",
    branchLabel: "Branch",
    branchHint: "Choose the branch whose print layout you want to manage.",
    noBranches: "No accessible branches are available.",
    inactive: "Inactive",
    documents: {
      salesReceipt: {
        title: "Sales receipt",
        description: "Printed after an order is paid.",
        badge: "Receipt",
      },
      ticketLabel: {
        title: "Service item label",
        description: "Printed from a service ticket for identifying items.",
        badge: "Label",
      },
    },
    receiptIdentityTitle: "Receipt identity and contact",
    receiptIdentityDescription:
      "Optional branch-specific values used in the receipt header and footer.",
    receiptName: "Printed branch name",
    receiptNamePlaceholder: "Use the branch name when empty",
    receiptPhone: "Printed phone",
    receiptPhonePlaceholder: "Use the branch phone when empty",
    receiptAddress: "Printed address",
    receiptAddressPlaceholder: "Use the branch address when empty",
    receiptThankYouMessage: "Thank-you message",
    receiptThankYouMessagePlaceholder:
      "Use the default message for the receipt language when empty",
    labelContentTitle: "Label print content",
    labelContentDescription:
      "Choose the information included when this branch prints a service item label.",
    labelGroups: {
      identity: "Business and ticket",
      items: "Customer and item",
      service: "Service details",
    },
    labelFields: {
      merchant_name: "Merchant name",
      branch_name: "Branch name",
      ticket_number: "Ticket number",
      customer_name: "Customer name",
      item_count: "Total item count",
      item_name: "Item or service name",
      item_measurement: "Quantity, weight and bags",
      item_price: "Item price",
      item_color: "Color",
      item_defect: "Defect notes",
      item_request: "Special request",
      label_code: "Label code",
      expected_pickup_at: "Expected pickup time",
    },
    required: "Required",
    save: "Save printing settings",
    saving: "Saving...",
    saved: "Printing settings saved",
    readOnly: "Only the tenant owner can change these settings.",
    loadError: "Printing settings could not be loaded.",
  },
  fr: {
    title: "Paramètres d’impression",
    description:
      "Gérez tous les documents imprimés au même endroit. Les règles s’appliquent à tous les terminaux de la succursale sélectionnée.",
    branchLabel: "Succursale",
    branchHint:
      "Choisissez la succursale dont vous souhaitez gérer l’impression.",
    noBranches: "Aucune succursale accessible n’est disponible.",
    inactive: "Inactive",
    documents: {
      salesReceipt: {
        title: "Reçu de vente",
        description: "Imprimé après le paiement d’une commande.",
        badge: "Reçu",
      },
      ticketLabel: {
        title: "Étiquette d’article de service",
        description:
          "Imprimée depuis une fiche de service pour identifier les articles.",
        badge: "Étiquette",
      },
    },
    receiptIdentityTitle: "Identité et contact du reçu",
    receiptIdentityDescription:
      "Valeurs facultatives propres à la succursale utilisées dans l’en-tête et le pied de page.",
    receiptName: "Nom de succursale imprimé",
    receiptNamePlaceholder: "Utiliser le nom de la succursale si vide",
    receiptPhone: "Téléphone imprimé",
    receiptPhonePlaceholder: "Utiliser le téléphone de la succursale si vide",
    receiptAddress: "Adresse imprimée",
    receiptAddressPlaceholder: "Utiliser l’adresse de la succursale si vide",
    receiptThankYouMessage: "Message de remerciement",
    receiptThankYouMessagePlaceholder:
      "Utiliser le message par défaut de la langue du reçu si vide",
    labelContentTitle: "Contenu de l’étiquette",
    labelContentDescription:
      "Choisissez les informations imprimées sur les étiquettes d’articles de service de cette succursale.",
    labelGroups: {
      identity: "Entreprise et fiche",
      items: "Client et article",
      service: "Détails du service",
    },
    labelFields: {
      merchant_name: "Nom du commerçant",
      branch_name: "Nom de la succursale",
      ticket_number: "Numéro de fiche",
      customer_name: "Nom du client",
      item_count: "Nombre total d’articles",
      item_name: "Nom de l’article ou du service",
      item_measurement: "Quantité, poids et sacs",
      item_price: "Prix de l’article",
      item_color: "Couleur",
      item_defect: "Notes de défaut",
      item_request: "Demande spéciale",
      label_code: "Code d’étiquette",
      expected_pickup_at: "Heure de retrait prévue",
    },
    required: "Obligatoire",
    save: "Enregistrer les paramètres",
    saving: "Enregistrement...",
    saved: "Paramètres d’impression enregistrés",
    readOnly: "Seul le propriétaire du locataire peut modifier ces paramètres.",
    loadError: "Les paramètres d’impression n’ont pas pu être chargés.",
  },
  "zh-CN": {
    title: "打印设置",
    description:
      "在一个页面集中管理所有打印文档；规则会应用于所选门店的全部 POS 终端。",
    branchLabel: "应用门店",
    branchHint: "先选择需要管理打印内容的门店。",
    noBranches: "当前没有可管理的门店。",
    inactive: "已停用",
    documents: {
      salesReceipt: {
        title: "销售小票",
        description: "订单完成付款后打印的收款凭证。",
        badge: "小票",
      },
      ticketLabel: {
        title: "工单物品标签",
        description: "从服务工单打印，用于识别衣物或其他服务物品。",
        badge: "标签",
      },
    },
    receiptIdentityTitle: "小票抬头与联系方式",
    receiptIdentityDescription: "设置该门店小票页眉、页脚使用的可选显示信息。",
    receiptName: "打印门店名称",
    receiptNamePlaceholder: "留空时使用门店名称",
    receiptPhone: "打印联系电话",
    receiptPhonePlaceholder: "留空时使用门店联系电话",
    receiptAddress: "打印地址",
    receiptAddressPlaceholder: "留空时使用门店地址",
    receiptThankYouMessage: "感谢语",
    receiptThankYouMessagePlaceholder: "留空时使用小票语言的默认感谢语",
    labelContentTitle: "标签打印内容",
    labelContentDescription: "选择该门店打印工单物品标签时需要包含的信息。",
    labelGroups: {
      identity: "商户与工单",
      items: "客户与物品",
      service: "服务详情",
    },
    labelFields: {
      merchant_name: "商户名称",
      branch_name: "门店名称",
      ticket_number: "工单编号",
      customer_name: "客户名称",
      item_count: "物品总数",
      item_name: "物品或服务名称",
      item_measurement: "数量、重量和袋数",
      item_price: "项目价格",
      item_color: "颜色",
      item_defect: "瑕疵备注",
      item_request: "特殊要求",
      label_code: "标签编码",
      expected_pickup_at: "预计取件时间",
    },
    required: "必选",
    save: "保存打印设置",
    saving: "保存中...",
    saved: "打印设置已保存",
    readOnly: "只有租户 Owner 可以修改打印设置。",
    loadError: "打印设置加载失败。",
  },
};

const labelGroups: Array<{
  key: keyof Copy["labelGroups"];
  fields: readonly PosTicketLabelField[];
}> = [
  {
    key: "identity",
    fields: ["merchant_name", "branch_name", "ticket_number"],
  },
  {
    key: "items",
    fields: [
      "customer_name",
      "item_count",
      "item_name",
      "item_measurement",
      "item_price",
    ],
  },
  {
    key: "service",
    fields: [
      "item_color",
      "item_defect",
      "item_request",
      "label_code",
      "expected_pickup_at",
    ],
  },
];

const requiredLabelFields = new Set<PosTicketLabelField>(
  REQUIRED_POS_TICKET_LABEL_FIELDS,
);

type EditableSettings = Pick<
  BranchSummary,
  | "receiptName"
  | "receiptPhone"
  | "receiptAddress"
  | "receiptThankYouMessage"
  | "receiptFields"
  | "ticketLabelFields"
>;

function toEditableSettings(branch: BranchSummary): EditableSettings {
  return {
    receiptName: branch.receiptName,
    receiptPhone: branch.receiptPhone,
    receiptAddress: branch.receiptAddress,
    receiptThankYouMessage: branch.receiptThankYouMessage,
    receiptFields: [...branch.receiptFields],
    ticketLabelFields: [...branch.ticketLabelFields],
  };
}

export function BranchPrintingSettingsView({
  initialBranches,
  initialError,
}: {
  initialBranches?: BranchSummary[];
  initialError?: string;
}) {
  const { locale } = useTenantI18n();
  const text = copy[locale];
  const { authLoaded, canUpdateSettings } = useTenantSettingsWorkspace();
  const [branches, setBranches] = useState(initialBranches ?? []);
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialBranches?.[0]?.id ?? "",
  );
  const [activeDocument, setActiveDocument] =
    useState<DocumentKey>("salesReceipt");
  const [saving, setSaving] = useState(false);
  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );
  const [form, setForm] = useState<EditableSettings | null>(() =>
    initialBranches?.[0] ? toEditableSettings(initialBranches[0]) : null,
  );

  function selectBranch(branchId: string) {
    const branch = branches.find((candidate) => candidate.id === branchId);
    setSelectedBranchId(branchId);
    setForm(branch ? toEditableSettings(branch) : null);
  }

  function updateLabelField(field: PosTicketLabelField, checked: boolean) {
    if (!form || requiredLabelFields.has(field)) return;

    const selected = checked
      ? [...form.ticketLabelFields, field]
      : form.ticketLabelFields.filter((candidate) => candidate !== field);
    setForm({
      ...form,
      ticketLabelFields: POS_TICKET_LABEL_FIELDS.filter((candidate) =>
        selected.includes(candidate),
      ),
    });
  }

  async function save() {
    if (!selectedBranch || !form) return;
    setSaving(true);

    try {
      const result = await updateBranchPrintingSettingsAction({
        branchId: selectedBranch.id,
        version: selectedBranch.version,
        receiptName: form.receiptName ?? "",
        receiptPhone: form.receiptPhone ?? "",
        receiptAddress: form.receiptAddress ?? "",
        receiptThankYouMessage: form.receiptThankYouMessage ?? "",
        receiptFields: form.receiptFields,
        ticketLabelFields: form.ticketLabelFields,
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

  return (
    <TenantSettingsSurface>
      <header className="flex flex-col gap-4 border-b border-black/10 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{text.title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            {text.description}
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
          <Label htmlFor="printing-settings-branch">{text.branchLabel}</Label>
          <Select
            disabled={branches.length === 0 || saving}
            onValueChange={selectBranch}
            value={selectedBranchId}
          >
            <SelectTrigger id="printing-settings-branch">
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
      ) : (
        <div className="grid min-h-[560px] lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav
            aria-label={text.title}
            className="border-b border-black/10 p-3 lg:border-b-0 lg:border-r"
          >
            {(
              [
                ["salesReceipt", ReceiptText],
                ["ticketLabel", Tags],
              ] as const
            ).map(([key, DocumentIcon]) => {
              const active = key === activeDocument;
              return (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                    active ? "bg-slate-100" : "hover:bg-slate-50",
                  )}
                  key={key}
                  onClick={() => setActiveDocument(key)}
                  type="button"
                >
                  <DocumentIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-slate-600"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-950">
                      {text.documents[key].title}
                      <Badge variant="secondary">
                        {text.documents[key].badge}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {text.documents[key].description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 px-4 py-5 sm:px-5">
            {activeDocument === "salesReceipt" ? (
              <div className="space-y-5">
                <section>
                  <h3 className="text-sm font-semibold text-slate-950">
                    {text.receiptIdentityTitle}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {text.receiptIdentityDescription}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="printing-receipt-name">
                        {text.receiptName}
                      </Label>
                      <Input
                        disabled={saving || !canUpdateSettings}
                        id="printing-receipt-name"
                        onChange={(event) =>
                          setForm({ ...form, receiptName: event.target.value })
                        }
                        placeholder={text.receiptNamePlaceholder}
                        value={form.receiptName ?? ""}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="printing-receipt-phone">
                        {text.receiptPhone}
                      </Label>
                      <Input
                        disabled={saving || !canUpdateSettings}
                        id="printing-receipt-phone"
                        onChange={(event) =>
                          setForm({ ...form, receiptPhone: event.target.value })
                        }
                        placeholder={text.receiptPhonePlaceholder}
                        value={form.receiptPhone ?? ""}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="printing-receipt-address">
                        {text.receiptAddress}
                      </Label>
                      <Textarea
                        disabled={saving || !canUpdateSettings}
                        id="printing-receipt-address"
                        onChange={(event) =>
                          setForm({
                            ...form,
                            receiptAddress: event.target.value,
                          })
                        }
                        placeholder={text.receiptAddressPlaceholder}
                        value={form.receiptAddress ?? ""}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="printing-receipt-thank-you-message">
                        {text.receiptThankYouMessage}
                      </Label>
                      <Textarea
                        disabled={saving || !canUpdateSettings}
                        id="printing-receipt-thank-you-message"
                        maxLength={500}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            receiptThankYouMessage: event.target.value,
                          })
                        }
                        placeholder={text.receiptThankYouMessagePlaceholder}
                        value={form.receiptThankYouMessage ?? ""}
                      />
                    </div>
                  </div>
                </section>

                <BranchReceiptFieldsEditor
                  disabled={saving || !canUpdateSettings}
                  onChange={(receiptFields) =>
                    setForm({ ...form, receiptFields })
                  }
                  value={form.receiptFields}
                />
              </div>
            ) : (
              <section>
                <h3 className="text-sm font-semibold text-slate-950">
                  {text.labelContentTitle}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {text.labelContentDescription}
                </p>
                <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                  {labelGroups.map((group) => (
                    <div className="space-y-2.5" key={group.key}>
                      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {text.labelGroups[group.key]}
                      </h4>
                      <div className="space-y-2.5">
                        {group.fields.map((field) => {
                          const required = requiredLabelFields.has(field);
                          const id = `printing-ticket-label-${field}`;
                          return (
                            <div
                              className="flex items-center gap-2.5"
                              key={field}
                            >
                              <Checkbox
                                checked={
                                  required ||
                                  form.ticketLabelFields.includes(field)
                                }
                                disabled={
                                  saving || !canUpdateSettings || required
                                }
                                id={id}
                                onCheckedChange={(checked) =>
                                  updateLabelField(field, checked === true)
                                }
                              />
                              <Label className="font-normal" htmlFor={id}>
                                {text.labelFields[field]}
                                {required ? (
                                  <span className="ml-1.5 text-xs text-slate-500">
                                    ({text.required})
                                  </span>
                                ) : null}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </TenantSettingsSurface>
  );
}
