"use client";

import type { CSSProperties } from "react";

import { LanguageSwitcher } from "@/components/i18n";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { AuthRedirectReason } from "@/config/auth-routing";
import { useWebAdminLocale } from "@/i18n";

import { LoginForm } from "./login-form";
import { LoginRedirectNotice } from "./login-redirect-notice";

type LoginPageContentProps = {
  reason?: AuthRedirectReason;
};

type AmbientParticle = {
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
  left: number;
  opacity: number;
  size: number;
  top: number;
};

function createAmbientParticles(count: number): AmbientParticle[] {
  let seed = 0x434c4541;

  function nextValue(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  return Array.from({ length: count }, () => ({
    delay: -(nextValue() * 18),
    driftX: Math.round(nextValue() * 90 - 45),
    driftY: Math.round(nextValue() * 110 - 55),
    duration: 10 + nextValue() * 12,
    left: nextValue() * 100,
    opacity: 0.16 + nextValue() * 0.38,
    size: 2 + nextValue() * 5,
    top: nextValue() * 100,
  }));
}

const ambientParticles = createAmbientParticles(64);

function LoginAmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-login-ambient
    >
      <div className="login-ambient-blob login-ambient-blob-one" />
      <div className="login-ambient-blob login-ambient-blob-two" />
      <div className="login-ambient-orbit login-ambient-orbit-one" />
      <div className="login-ambient-orbit login-ambient-orbit-two" />

      <div className="absolute inset-0">
        {ambientParticles.map((particle, index) => (
          <span
            className="login-ambient-particle"
            key={index}
            style={
              {
                "--login-particle-drift-x": `${particle.driftX}px`,
                "--login-particle-drift-x-alt": `${Math.round(
                  particle.driftX * -0.35,
                )}px`,
                "--login-particle-drift-y": `${particle.driftY}px`,
                "--login-particle-drift-y-alt": `${Math.round(
                  particle.driftY * 0.28,
                )}px`,
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
      </div>

      <svg
        className="login-ambient-grain"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <filter
          height="140%"
          id="login-ambient-noise"
          width="140%"
          x="-20%"
          y="-20%"
        >
          <feTurbulence
            baseFrequency="0.72"
            numOctaves="4"
            seed="37"
            stitchTiles="stitch"
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          className="login-ambient-grain-fill"
          filter="url(#login-ambient-noise)"
          height="100%"
          opacity="0.14"
          width="100%"
        />
      </svg>

      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 dark:from-white/5 dark:to-white/5" />
    </div>
  );
}

export function LoginPageContent({ reason }: LoginPageContentProps) {
  const { messages } = useWebAdminLocale();
  const auth = messages.auth;
  const year = new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <LoginRedirectNotice reason={reason} />
      <LoginAmbientBackdrop />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.86)_28%,rgba(255,255,255,0.24)_58%,transparent_72%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(39,39,42,0.9)_0%,rgba(24,24,27,0.68)_34%,transparent_72%)]"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-950 text-xs font-extrabold tracking-tight text-white shadow-[0_10px_32px_rgba(24,24,27,0.18)] dark:bg-white dark:text-zinc-950">
              CH
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">
                {auth.brandName}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-400 sm:text-[10px]">
                {auth.brandSuffix}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-zinc-950/10 bg-white/90 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70">
            <ThemeToggle />
            <LanguageSwitcher iconOnly />
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-[30rem]">
            <div className="mx-auto max-w-md text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {auth.title}
              </h1>
            </div>

            <LoginForm />
          </div>
        </section>

        <footer className="mx-auto w-full max-w-7xl px-5 py-5 text-[11px] text-zinc-600 dark:text-zinc-400 sm:px-8 lg:px-10">
          <span>© {year} CleanHub</span>
        </footer>
      </div>
    </main>
  );
}
