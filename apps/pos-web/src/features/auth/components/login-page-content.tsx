"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { CSSProperties } from "react";

import { LanguageSwitcher } from "@/components/i18n";
import { TerminalPinLoginGate } from "@/features/terminal-setup/components/terminal-pin-login-gate";

import { LoginForm } from "./login-form";

type AmbientParticle = {
  delay: number;
  duration: number;
  left: number;
  opacity: number;
  size: number;
  top: number;
};

function createAmbientParticles(count: number): AmbientParticle[] {
  let seed = 0x504f5343;

  function nextValue(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  return Array.from({ length: count }, () => ({
    delay: -(nextValue() * 14),
    duration: 8 + nextValue() * 10,
    left: nextValue() * 100,
    opacity: 0.1 + nextValue() * 0.24,
    size: 1.5 + nextValue() * 4,
    top: nextValue() * 100,
  }));
}

const ambientParticles = createAmbientParticles(64);

function LoginAmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden login-desktop:block"
    >
      <div className="absolute -left-[18rem] top-[8%] size-[38rem] animate-[spin_42s_linear_infinite] rounded-[43%_57%_64%_36%/55%_38%_62%_45%] border border-black/[0.08] motion-reduce:animate-none" />
      <div className="absolute -right-[16rem] bottom-[-8rem] size-[34rem] animate-[spin_54s_linear_infinite_reverse] rounded-[61%_39%_46%_54%/37%_58%_42%_63%] border border-black/[0.07] motion-reduce:animate-none" />
      <div className="absolute -left-28 top-[16%] h-80 w-80 rounded-full bg-zinc-300/55 blur-3xl" />
      <div className="absolute -right-32 bottom-[8%] h-96 w-96 rounded-full bg-zinc-400/40 blur-3xl" />

      {ambientParticles.map((particle, index) => (
        <span
          className="absolute animate-pulse rounded-full bg-black motion-reduce:animate-none"
          key={index}
          style={
            {
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              opacity: particle.opacity,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
            } as CSSProperties
          }
        />
      ))}

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.055]"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <filter
          height="140%"
          id="pos-login-noise"
          width="140%"
          x="-20%"
          y="-20%"
        >
          <feTurbulence
            baseFrequency="0.78"
            numOctaves="4"
            seed="29"
            stitchTiles="stitch"
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect filter="url(#pos-login-noise)" height="100%" width="100%" />
      </svg>
    </div>
  );
}

export function LoginPageContent() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <main
      className="relative min-h-screen min-h-dvh overflow-x-hidden bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-foreground"
      data-pos-i18n-managed="true"
    >
      <LoginAmbientBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.86)_28%,rgba(255,255,255,0.24)_58%,transparent_72%)] login-desktop:block"
      />

      <div className="relative z-10 flex min-h-screen min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8 lg:px-10 login-desktop:py-7">
          <div className="flex items-center gap-2.5 md:gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-[11px] font-extrabold tracking-tight text-background md:size-10 md:text-xs login-desktop:rounded-xl login-desktop:shadow-[0_10px_32px_rgba(24,24,27,0.18)]">
              CH
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight md:text-base">
                CleanHub
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:text-[10px]">
                {t("pos.auth.brandSuffix")}
              </p>
            </div>
          </div>
          <div className="login-desktop:rounded-xl login-desktop:border login-desktop:border-border/80 login-desktop:bg-background/90 login-desktop:p-1 login-desktop:shadow-sm login-desktop:backdrop-blur-xl">
            <LanguageSwitcher />
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-5 pb-5 pt-1 md:px-8 login-desktop:py-12">
          <div className="w-full max-w-[30rem]">
            <div className="mx-auto max-w-md text-center">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl login-desktop:text-4xl">
                {t("pos.auth.loginTitle")}
              </h1>
              <p className="mt-3 hidden text-[15px] font-medium leading-6 text-foreground/80 login-desktop:block">
                {t("pos.auth.heroTitleLine1")} {t("pos.auth.heroTitleLine2")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground login-desktop:mt-1.5">
                {t("pos.auth.loginDescription")}
              </p>
            </div>

            <div className="mt-4 login-desktop:mt-6">
              <TerminalPinLoginGate>
                {(bootstrap) => (
                  <div className="login-desktop:rounded-2xl login-desktop:border login-desktop:border-border/80 login-desktop:bg-background/[0.96] login-desktop:p-6 login-desktop:shadow-[0_28px_80px_-34px_rgba(0,0,0,0.58)] login-desktop:backdrop-blur-2xl">
                    {bootstrap.tenant || bootstrap.branch ? (
                      <>
                        <div className="mb-3 text-center login-desktop:hidden">
                          {bootstrap.branch ? (
                            <p className="truncate text-sm font-semibold text-foreground">
                              {bootstrap.branch.name}
                            </p>
                          ) : null}
                          {bootstrap.tenant ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {bootstrap.tenant.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="mb-4 hidden flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-muted/65 px-3 py-2 text-xs text-muted-foreground login-desktop:flex">
                          {bootstrap.tenant ? (
                            <span className="font-medium text-foreground">
                              {bootstrap.tenant.name}
                            </span>
                          ) : null}
                          {bootstrap.tenant && bootstrap.branch ? (
                            <span aria-hidden="true">·</span>
                          ) : null}
                          {bootstrap.branch ? (
                            <span>{bootstrap.branch.name}</span>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    <LoginForm />
                  </div>
                )}
              </TerminalPinLoginGate>
            </div>
          </div>
        </section>

        <footer className="mx-auto hidden w-full max-w-7xl px-5 py-5 text-[11px] text-muted-foreground md:px-8 lg:px-10 login-desktop:block">
          {t("pos.app.copyright", { year })}
        </footer>
      </div>
    </main>
  );
}
