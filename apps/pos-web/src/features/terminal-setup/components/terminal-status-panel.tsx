"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { Button } from "@cleanhub/ui";
import Link from "next/link";

import {
  Icon,
  type PosIconName,
} from "@/components/app-shell/icons";
import { posRoutes } from "@/config/routes";

import { getTerminalSetupCopy } from "../copy";

type TerminalStatusPanelProps = {
  kind: "loading" | "error" | "disabled" | "setup";
  onRetry?: () => void;
  recovery?: boolean;
};

export function TerminalStatusPanel({
  kind,
  onRetry,
  recovery = false,
}: TerminalStatusPanelProps) {
  const { locale } = useTranslation();
  const copy = getTerminalSetupCopy(locale);

  const content =
    kind === "loading"
      ? {
          icon: "rotate-ccw" as PosIconName,
          title: copy.bootstrap.loading,
          description: copy.bootstrap.loadingDescription,
          iconClassName: "animate-spin",
        }
      : kind === "error"
        ? {
            icon: "alert" as PosIconName,
            title: copy.bootstrap.errorTitle,
            description: copy.bootstrap.errorDescription,
            iconClassName: "",
          }
        : kind === "disabled"
          ? {
              icon: "lock" as PosIconName,
              title: copy.bootstrap.disabledTitle,
              description: copy.bootstrap.disabledDescription,
              iconClassName: "",
            }
          : {
              icon: (recovery ? "shield-check" : "monitor") as PosIconName,
              title: recovery
                ? copy.bootstrap.credentialLostTitle
                : copy.bootstrap.setupRequiredTitle,
              description: recovery
                ? copy.bootstrap.credentialLostDescription
                : copy.bootstrap.setupRequiredDescription,
              iconClassName: "",
            };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/[0.94] p-6 text-center shadow-[0_28px_80px_-40px_rgba(0,0,0,0.58)] backdrop-blur-2xl sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-black text-white shadow-lg shadow-black/10">
        <Icon
          className={`size-5 ${content.iconClassName}`}
          name={content.icon}
        />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
        {content.title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {content.description}
      </p>

      {kind === "disabled" ? (
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-muted/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
          {copy.bootstrap.disabledHint}
        </p>
      ) : null}

      {kind === "setup" ? (
        <Button asChild className="mt-6 h-10 rounded-xl px-5">
          <Link href={posRoutes.setup}>{copy.bootstrap.startSetup}</Link>
        </Button>
      ) : null}

      {kind === "error" && onRetry ? (
        <Button
          className="mt-6 h-10 rounded-xl px-5"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <Icon className="size-4" name="rotate-ccw" />
          {copy.bootstrap.retry}
        </Button>
      ) : null}
    </div>
  );
}
