"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { CSSProperties } from "react";

import { LanguageSwitcher } from "@/components/i18n";

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
    delay: -(nextValue() * 8),
    duration: 5 + nextValue() * 7,
    left: nextValue() * 100,
    opacity: 0.05 + nextValue() * 0.13,
    size: 1 + nextValue() * 3,
    top: nextValue() * 100,
  }));
}

const ambientParticles = createAmbientParticles(48);

function LoginAmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute -left-28 top-[16%] h-80 w-80 rounded-full bg-zinc-200/60 blur-3xl" />
      <div className="absolute -right-32 bottom-[8%] h-96 w-96 rounded-full bg-zinc-300/50 blur-3xl" />

      {ambientParticles.map((particle, index) => (
        <span
          className="absolute animate-pulse rounded-full bg-black"
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
        className="absolute inset-0 h-full w-full opacity-[0.035]"
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
        <rect
          filter="url(#pos-login-noise)"
          height="100%"
          width="100%"
        />
      </svg>
    </div>
  );
}

export function LoginPageContent() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <main
      className="relative min-h-screen min-h-dvh overflow-hidden bg-[#f4f4f3] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-zinc-950"
      data-pos-i18n-managed="true"
    >
      <LoginAmbientBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.76)_31%,rgba(255,255,255,0.22)_62%,transparent_78%)]"
      />

      <div className="relative z-10 flex min-h-screen min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-xs font-extrabold tracking-tight text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
              CH
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">CleanHub POS</p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t("pos.auth.brandSuffix")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </header>

        <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-[27rem]">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
                {t("pos.auth.heroTitleLine1")}
                {" "}
                {t("pos.auth.heroTitleLine2")}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-[2rem]">
                {t("pos.auth.loginTitle")}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600">
                {t("pos.auth.loginDescription")}
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-[0_24px_70px_rgba(24,24,27,0.10)] backdrop-blur-xl sm:p-6">
              <LoginForm />
            </div>
          </div>
        </section>

        <footer className="mx-auto w-full max-w-6xl px-5 py-5 text-[11px] text-zinc-500 sm:px-8">
          {t("pos.app.copyright", { year })}
        </footer>
      </div>
    </main>
  );
}
