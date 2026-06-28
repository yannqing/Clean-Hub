"use client";

import { mobileReleaseConfig, isMobileUpdateRequired } from "@/lib/mobile-release-config";

export function MobileUpdateRequired() {
  if (!isMobileUpdateRequired()) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 px-5">
      <section className="w-full max-w-sm rounded-lg bg-white p-5 text-zinc-950 shadow-xl">
        <h1 className="text-lg font-semibold">Mise a jour requise</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-700">
          Cette version de CleanHub Mobile n&apos;est plus prise en charge. Installez la derniere version
          avant de continuer.
        </p>
        <a
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
          href={mobileReleaseConfig.updateUrl}
        >
          Mettre a jour
        </a>
      </section>
    </div>
  );
}
