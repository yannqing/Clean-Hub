"use client";

import {
  POS_RECEIPT_FIELDS,
  REQUIRED_POS_RECEIPT_FIELDS,
  type PosReceiptField,
} from "@cleanhub/domain/receipt";
import { Checkbox, Label } from "@cleanhub/ui";

import { useTenantI18n } from "@/i18n";

type Copy = {
  title: string;
  description: string;
  required: string;
  groups: Record<"identity" | "items" | "amounts" | "footer", string>;
  fields: Record<PosReceiptField, string>;
};

const copy: Record<"en" | "fr" | "zh-CN", Copy> = {
  en: {
    title: "Receipt print content",
    description:
      "Choose the information printed by every POS terminal in this branch.",
    required: "Required",
    groups: {
      identity: "Receipt and sale",
      items: "Products and services",
      amounts: "Amounts and payment",
      footer: "Contact and footer",
    },
    fields: {
      merchant_name: "Merchant name",
      branch_name: "Branch name",
      receipt_title: "Receipt title",
      receipt_number: "Receipt number",
      order_number: "Order number",
      issued_at: "Sale date and time",
      cashier_name: "Cashier name",
      terminal_name: "POS terminal name",
      customer_name: "Customer name",
      item_name: "Product or service name",
      item_quantity: "Quantity",
      item_unit_price: "Unit price",
      item_line_total: "Line total",
      item_sku: "SKU",
      item_barcode: "Barcode",
      item_notes: "Item details and notes",
      subtotal: "Subtotal",
      discount: "Discount",
      taxable_amount: "Taxable amount",
      tax: "Tax",
      tax_registration_number: "Tax registration number",
      tax_exemption_reason: "Tax exemption reason",
      rounding: "Rounding adjustment",
      total: "Total",
      paid_amount: "Paid amount",
      cash_tendered: "Cash received",
      change: "Change",
      balance: "Balance",
      payment_method: "Payment method",
      receipt_address: "Receipt address",
      receipt_phone: "Receipt phone",
      thank_you_message: "Thank-you message",
    },
  },
  fr: {
    title: "Contenu du reçu imprimé",
    description:
      "Choisissez les informations imprimées par chaque terminal de cette succursale.",
    required: "Obligatoire",
    groups: {
      identity: "Reçu et vente",
      items: "Produits et services",
      amounts: "Montants et paiement",
      footer: "Contact et pied de page",
    },
    fields: {
      merchant_name: "Nom du commerçant",
      branch_name: "Nom de la succursale",
      receipt_title: "Titre du reçu",
      receipt_number: "Numéro du reçu",
      order_number: "Numéro de commande",
      issued_at: "Date et heure de vente",
      cashier_name: "Nom du caissier",
      terminal_name: "Nom du terminal POS",
      customer_name: "Nom du client",
      item_name: "Nom du produit ou service",
      item_quantity: "Quantité",
      item_unit_price: "Prix unitaire",
      item_line_total: "Total de la ligne",
      item_sku: "SKU",
      item_barcode: "Code-barres",
      item_notes: "Détails et notes de l’article",
      subtotal: "Sous-total",
      discount: "Remise",
      taxable_amount: "Montant imposable",
      tax: "Taxe",
      tax_registration_number: "Numéro fiscal",
      tax_exemption_reason: "Motif d’exonération",
      rounding: "Ajustement d’arrondi",
      total: "Total",
      paid_amount: "Montant payé",
      cash_tendered: "Espèces reçues",
      change: "Monnaie",
      balance: "Solde",
      payment_method: "Mode de paiement",
      receipt_address: "Adresse du reçu",
      receipt_phone: "Téléphone du reçu",
      thank_you_message: "Message de remerciement",
    },
  },
  "zh-CN": {
    title: "小票打印内容",
    description: "选择该门店所有 POS 终端打印小票时需要包含的信息。",
    required: "必选",
    groups: {
      identity: "小票与销售信息",
      items: "产品与服务明细",
      amounts: "金额与支付信息",
      footer: "联系信息与页脚",
    },
    fields: {
      merchant_name: "商户名称",
      branch_name: "门店名称",
      receipt_title: "小票标题",
      receipt_number: "小票编号",
      order_number: "订单号",
      issued_at: "销售日期与时间",
      cashier_name: "收银员名称",
      terminal_name: "POS 终端名称",
      customer_name: "客户名称",
      item_name: "产品或服务名称",
      item_quantity: "数量",
      item_unit_price: "单价",
      item_line_total: "项目金额",
      item_sku: "SKU",
      item_barcode: "条形码",
      item_notes: "项目详情与备注",
      subtotal: "小计",
      discount: "优惠金额",
      taxable_amount: "应税金额",
      tax: "税费",
      tax_registration_number: "税务登记号",
      tax_exemption_reason: "免税原因",
      rounding: "舍入调整",
      total: "合计",
      paid_amount: "已付金额",
      cash_tendered: "实收现金",
      change: "找零",
      balance: "未付余额",
      payment_method: "支付方式",
      receipt_address: "小票地址",
      receipt_phone: "小票联系电话",
      thank_you_message: "感谢语",
    },
  },
};

const groups: Array<{
  key: keyof Copy["groups"];
  fields: readonly PosReceiptField[];
}> = [
  {
    key: "identity",
    fields: [
      "merchant_name",
      "branch_name",
      "receipt_title",
      "receipt_number",
      "order_number",
      "issued_at",
      "cashier_name",
      "terminal_name",
      "customer_name",
    ],
  },
  {
    key: "items",
    fields: [
      "item_name",
      "item_quantity",
      "item_unit_price",
      "item_line_total",
      "item_sku",
      "item_barcode",
      "item_notes",
    ],
  },
  {
    key: "amounts",
    fields: [
      "subtotal",
      "discount",
      "taxable_amount",
      "tax",
      "tax_registration_number",
      "tax_exemption_reason",
      "rounding",
      "total",
      "paid_amount",
      "cash_tendered",
      "change",
      "balance",
      "payment_method",
    ],
  },
  {
    key: "footer",
    fields: ["receipt_address", "receipt_phone", "thank_you_message"],
  },
];

const requiredFieldSet = new Set<PosReceiptField>(REQUIRED_POS_RECEIPT_FIELDS);

export function BranchReceiptFieldsEditor({
  disabled,
  error,
  onChange,
  value,
}: {
  disabled?: boolean;
  error?: string;
  onChange: (value: PosReceiptField[]) => void;
  value: PosReceiptField[];
}) {
  const { locale } = useTenantI18n();
  const text = copy[locale];

  function update(field: PosReceiptField, checked: boolean) {
    if (requiredFieldSet.has(field)) return;
    const selected = checked
      ? [...value, field]
      : value.filter((candidate) => candidate !== field);
    onChange(
      POS_RECEIPT_FIELDS.filter((candidate) => selected.includes(candidate)),
    );
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{text.title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {text.description}
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {groups.map((group) => (
          <section className="space-y-2.5" key={group.key}>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {text.groups[group.key]}
            </h4>
            <div className="space-y-2.5">
              {group.fields.map((field) => {
                const required = requiredFieldSet.has(field);
                const id = `branch-receipt-field-${field}`;
                return (
                  <div className="flex items-center gap-2.5" key={field}>
                    <Checkbox
                      checked={required || value.includes(field)}
                      disabled={disabled || required}
                      id={id}
                      onCheckedChange={(checked) =>
                        update(field, checked === true)
                      }
                    />
                    <Label className="font-normal" htmlFor={id}>
                      {text.fields[field]}
                      {required ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({text.required})
                        </span>
                      ) : null}
                    </Label>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
