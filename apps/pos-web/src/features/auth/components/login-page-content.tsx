"use client";

import { useTranslation } from "@cleanhub/i18n/react";

import { LanguageSwitcher } from "@/components/i18n";

import { LoginForm } from "./login-form";

export function LoginPageContent() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <main
      className="flex min-h-screen min-h-dvh bg-[#F7F9FC] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-slate-900"
      data-pos-i18n-managed="true"
    >
      <aside className="relative hidden w-[440px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="CleanHub mark"
            className="h-11 w-11 rounded-xl bg-white/20 object-cover p-1"
            src="/cleanhub-logo-mark.jpg"
          />
          <div>
            <div className="text-lg font-extrabold tracking-tight">
              CleanHub POS
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
              {t("pos.auth.brandSuffix")}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            {t("pos.auth.heroTitleLine1")}
            <br />
            {t("pos.auth.heroTitleLine2")}
          </h1>
          <p className="max-w-xs text-sm leading-6 text-white/80">
            {t("pos.auth.heroDescription")}
          </p>
        </div>

        <p className="text-xs text-white/60">
          {t("pos.app.copyright", { year })}
        </p>
      </aside>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-end">
            <LanguageSwitcher />
          </div>

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              CleanHub POS
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {t("pos.auth.loginTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {t("pos.auth.loginDescription")}
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
