"use client";

import { PagePlaceholder } from "./page-placeholder";
import { useSaasI18n } from "@/i18n";

type SaasPlaceholderPageKey = keyof ReturnType<typeof useSaasI18n>["m"]["placeholders"];

type SaasPagePlaceholderProps = {
  page: SaasPlaceholderPageKey;
};

export function SaasPagePlaceholder({ page }: SaasPagePlaceholderProps) {
  const { m } = useSaasI18n();
  const copy = m.placeholders[page];

  return (
    <PagePlaceholder
      description={copy.description}
      items={[...copy.items]}
      modulePlaceholderLabel={m.common.modulePlaceholder}
      title={copy.title}
    />
  );
}
