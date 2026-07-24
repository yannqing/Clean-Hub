"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cleanhub/ui";
import {
  ArrowLeft,
  BadgeDollarSign,
  Barcode,
  Boxes,
  PackagePlus,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

export function ProductCreateView() {
  const { m } = useTenantI18n();

  function preventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-6 pb-8"
      data-testid="tenant-product-create-view"
    >
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Icon aria-hidden icon={PackagePlus} size={19} />
            <span>{m.products.create.title}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.products.create.description}
          </p>
        </div>

        <Button asChild className="shrink-0" size="sm" variant="outline">
          <Link href={webAdminRoutes.tenant.products}>
            <Icon aria-hidden icon={ArrowLeft} size={14} />
            <span>{m.products.create.backToProducts}</span>
          </Link>
        </Button>
      </header>

      <form className="space-y-5" onSubmit={preventSubmit}>
        <div className="grid gap-5">
          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden icon={PackagePlus} size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm">
                    {m.products.create.sections.basic.title}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {m.products.create.sections.basic.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 py-5">
              <div className="grid gap-2">
                <Label htmlFor="product-name">
                  {m.products.create.fields.name} <RequiredMark />
                </Label>
                <Input
                  aria-required="true"
                  id="product-name"
                  maxLength={200}
                  name="name"
                  placeholder={m.products.create.placeholders.name}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-category">
                    {m.products.create.fields.category}
                  </Label>
                  <Input
                    id="product-category"
                    name="category"
                    placeholder={m.products.create.placeholders.category}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-brand">
                    {m.products.create.fields.brand}
                  </Label>
                  <Input
                    id="product-brand"
                    maxLength={120}
                    name="brand"
                    placeholder={m.products.create.placeholders.brand}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-status">
                  {m.products.create.fields.status}
                </Label>
                <Select defaultValue="active" name="status">
                  <SelectTrigger id="product-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      {m.products.statusLabels.active}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {m.products.statusLabels.inactive}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-description">
                  {m.products.create.fields.description}
                </Label>
                <Textarea
                  className="min-h-28 resize-y"
                  id="product-description"
                  name="description"
                  placeholder={m.products.create.placeholders.description}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden icon={Barcode} size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm">
                    {m.products.create.sections.sku.title}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {m.products.create.sections.sku.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-sku-code">
                    {m.products.create.fields.skuCode} <RequiredMark />
                  </Label>
                  <Input
                    aria-required="true"
                    id="product-sku-code"
                    maxLength={80}
                    name="skuCode"
                    placeholder={m.products.create.placeholders.skuCode}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-barcode">
                    {m.products.create.fields.barcode}
                  </Label>
                  <Input
                    id="product-barcode"
                    maxLength={80}
                    name="barcode"
                    placeholder={m.products.create.placeholders.barcode}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-variant-name">
                  {m.products.create.fields.variantName}
                </Label>
                <Input
                  id="product-variant-name"
                  maxLength={160}
                  name="variantName"
                  placeholder={m.products.create.placeholders.variantName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-unit">
                    {m.products.create.fields.unitOfMeasure}
                  </Label>
                  <Select defaultValue="piece" name="unitOfMeasure">
                    <SelectTrigger id="product-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">
                        {m.products.create.unitOptions.piece}
                      </SelectItem>
                      <SelectItem value="box">
                        {m.products.create.unitOptions.box}
                      </SelectItem>
                      <SelectItem value="bottle">
                        {m.products.create.unitOptions.bottle}
                      </SelectItem>
                      <SelectItem value="pack">
                        {m.products.create.unitOptions.pack}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-units-per-sale">
                    {m.products.create.fields.unitsPerSale}
                  </Label>
                  <Input
                    defaultValue="1"
                    id="product-units-per-sale"
                    min="0.001"
                    name="unitsPerSale"
                    step="0.001"
                    type="number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden icon={BadgeDollarSign} size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm">
                    {m.products.create.sections.pricing.title}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {m.products.create.sections.pricing.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-sale-price">
                    {m.products.create.fields.salePrice} <RequiredMark />
                  </Label>
                  <Input
                    aria-required="true"
                    id="product-sale-price"
                    min="0"
                    name="salePrice"
                    placeholder="0.00"
                    required
                    step="0.01"
                    type="number"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-currency">
                    {m.products.create.fields.currency} <RequiredMark />
                  </Label>
                  <Input
                    aria-required="true"
                    id="product-currency"
                    maxLength={3}
                    name="currency"
                    placeholder={m.products.create.placeholders.currency}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-reference-cost">
                  {m.products.create.fields.referenceCost}
                </Label>
                <Input
                  id="product-reference-cost"
                  min="0"
                  name="referenceCost"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon aria-hidden icon={Boxes} size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm">
                    {m.products.create.sections.inventory.title}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {m.products.create.sections.inventory.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 py-5">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                htmlFor="product-track-inventory"
              >
                <Checkbox
                  defaultChecked
                  id="product-track-inventory"
                  name="trackInventory"
                />
                <span className="text-sm font-medium leading-4">
                  {m.products.create.fields.trackInventory}
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="product-opening-stock">
                    {m.products.create.fields.openingStock}
                  </Label>
                  <Input
                    id="product-opening-stock"
                    min="0"
                    name="openingStock"
                    placeholder="0"
                    step="0.001"
                    type="number"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product-reorder-point">
                    {m.products.create.fields.reorderPoint}
                  </Label>
                  <Input
                    id="product-reorder-point"
                    min="0"
                    name="reorderPoint"
                    placeholder="0"
                    step="0.001"
                    type="number"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                  htmlFor="product-negative-stock"
                >
                  <Checkbox
                    id="product-negative-stock"
                    name="allowNegativeStock"
                  />
                  <span className="text-sm">
                    {m.products.create.fields.allowNegativeStock}
                  </span>
                </label>

                <label
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                  htmlFor="product-offline-sale"
                >
                  <Checkbox id="product-offline-sale" name="allowOfflineSale" />
                  <span className="text-sm">
                    {m.products.create.fields.allowOfflineSale}
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {m.products.create.requiredHint}
          </p>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={webAdminRoutes.tenant.products}>
                {m.common.cancel}
              </Link>
            </Button>
            <Button
              disabled
              title={m.products.create.saveUnavailable}
              type="button"
            >
              {m.products.create.saveProduct}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
