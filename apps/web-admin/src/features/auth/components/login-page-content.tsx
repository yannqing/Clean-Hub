"use client";

import { LanguageSwitcher } from "@/components/i18n";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { AuthRedirectReason } from "@/config/auth-routing";
import { useWebAdminLocale } from "@/i18n";

import { LoginForm } from "./login-form";
import { LoginRedirectNotice } from "./login-redirect-notice";

type LoginPageContentProps = {
  reason?: AuthRedirectReason;
};

export function LoginPageContent({ reason }: LoginPageContentProps) {
  const { messages } = useWebAdminLocale();
  const auth = messages.auth;
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <LoginRedirectNotice reason={reason} />

      <div className="grid min-h-screen lg:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
        <aside className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white text-sm font-extrabold tracking-tight text-zinc-950">
              CH
            </span>
            <div>
              <p className="font-bold tracking-tight">{auth.brandName}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/65">
                {auth.brandSuffix}
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              {auth.heroTitle}
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/75 xl:text-base">
              {auth.heroDescription}
            </p>
          </div>

          <p className="text-xs text-white/55">© {year} CleanHub</p>
        </aside>

        <section className="flex min-h-screen flex-col bg-background px-4 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
          <header className="mx-auto flex w-full max-w-md justify-end gap-2">
            <ThemeToggle />
            <LanguageSwitcher iconOnly />
          </header>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-xs font-extrabold text-background shadow-sm">
                  CH
                </span>
                <div>
                  <p className="text-sm font-bold tracking-tight">
                    {auth.brandName}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {auth.brandSuffix}
                  </p>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {auth.brandSuffix}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {auth.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {auth.description}
              </p>

              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
