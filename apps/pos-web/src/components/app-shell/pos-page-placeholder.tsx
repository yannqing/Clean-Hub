"use client";

import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";

import type { PosIconName } from "./icons";

import { Icon } from "./icons";
import { PosBreadcrumb } from "./pos-breadcrumb";

type PosPagePlaceholderProps = {
  icon: PosIconName;
  title: string;
  description?: string;
  breadcrumb?: string;
};

export function PosPagePlaceholder({
  icon,
  title,
  description,
  breadcrumb = title,
}: PosPagePlaceholderProps) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <section>
      <PosBreadcrumb className="mb-5" items={[{ label: text(breadcrumb) }]} />

      <div className="flex min-h-64 flex-col items-center justify-center border-y border-border bg-background px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" name={icon} />
        </span>
        <h1 className="mt-4 text-base font-semibold text-foreground">
          {text(title)}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            {text(description)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
