"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";

import { Icon } from "@/components/app-shell/icons";
import { LanguageSwitcher } from "@/components/i18n";

import { getTerminalSetupCopy } from "../copy";
import type { SetupStep } from "../types";

const STEP_ORDER: Exclude<SetupStep, "complete">[] = [
  "admin",
  "branch",
  "terminal",
];

type TerminalSetupShellProps = {
  children: React.ReactNode;
  currentStep?: SetupStep;
  showProgress?: boolean;
};

function stepIndex(step: SetupStep | undefined): number {
  if (step === "complete") return STEP_ORDER.length;
  return step ? STEP_ORDER.indexOf(step) : -1;
}

export function TerminalSetupShell({
  children,
  currentStep,
  showProgress = false,
}: TerminalSetupShellProps) {
  const { locale } = useTranslation();
  const copy = getTerminalSetupCopy(locale);
  const currentIndex = stepIndex(currentStep);

  return (
    <main className="relative min-h-screen min-h-dvh overflow-hidden bg-[#f5f5f4] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-[-15rem] top-[-12rem] size-[38rem] rounded-full border border-black/[0.06]" />
        <div className="absolute right-[-13rem] top-[18%] size-[30rem] rounded-[42%_58%_63%_37%/51%_44%_56%_49%] border border-black/[0.055]" />
        <div className="absolute bottom-[-13rem] left-[20%] size-[32rem] rounded-full bg-white/70 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(#000_0.7px,transparent_0.7px)] [background-size:11px_11px]" />
      </div>

      <div className="relative z-10 flex min-h-screen min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-black text-xs font-extrabold tracking-tight text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
              CH
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight sm:text-base">
                CleanHub
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
                {copy.brandSuffix}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white/80 p-1 shadow-sm backdrop-blur-xl">
            <LanguageSwitcher />
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-4 py-6 sm:px-8 sm:py-10">
          <div className="w-full max-w-[46rem]">
            {showProgress ? (
              <ol
                aria-label={copy.setup.eyebrow}
                className="mx-auto mb-5 grid max-w-xl grid-cols-3 gap-2 sm:mb-7"
              >
                {STEP_ORDER.map((step, index) => {
                  const complete = index < currentIndex;
                  const active = index === currentIndex;

                  return (
                    <li
                      aria-current={active ? "step" : undefined}
                      className="min-w-0"
                      key={step}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                            complete &&
                              "border-black bg-black text-white",
                            active &&
                              "border-black bg-white text-black shadow-sm",
                            !complete &&
                              !active &&
                              "border-black/10 bg-white/45 text-muted-foreground",
                          )}
                        >
                          {complete ? (
                            <Icon className="size-3" name="check" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={cn(
                            "truncate text-[11px] font-medium sm:text-xs",
                            active || complete
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {copy.setup.steps[step]}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "mt-2 block h-0.5 rounded-full bg-black/10",
                          (active || complete) && "bg-black",
                        )}
                      />
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {children}
          </div>
        </section>

        <footer className="mx-auto w-full max-w-6xl px-5 py-5 text-[11px] text-muted-foreground sm:px-8">
          CleanHub POS · {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
