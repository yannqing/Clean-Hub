"use client";

import { Icon } from "@cleanhub/ui";
import { Flag, Globe2, UserRound, type LucideIcon } from "lucide-react";

import { SaasPageHeader } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";

type SaasPlaceholderPageKey = keyof ReturnType<
  typeof useSaasI18n
>["m"]["placeholders"];

type SaasPagePlaceholderProps = {
  page: SaasPlaceholderPageKey;
};

const iconByPage: Record<SaasPlaceholderPageKey, LucideIcon> = {
  featureFlags: Flag,
  localization: Globe2,
  profile: UserRound,
};

export function SaasPagePlaceholder({ page }: SaasPagePlaceholderProps) {
  const { m } = useSaasI18n();
  const copy = m.placeholders[page];

  return (
    <section className="mx-auto w-full max-w-[860px] space-y-7 pb-16">
      <SaasPageHeader
        description={copy.description}
        icon={iconByPage[page]}
        title={copy.title}
      />

      <div className="grid border-y bg-background sm:grid-cols-2">
        {copy.items.map((item, index) => (
          <div
            className="flex min-h-20 items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:border-r"
            key={item}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon aria-hidden icon={iconByPage[page]} size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item}</p>
            </div>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
