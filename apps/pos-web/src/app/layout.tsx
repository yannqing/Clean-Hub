import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";
import { isSupportedLocale } from "@cleanhub/i18n";
import { cookies } from "next/headers";

import { PosI18nProvider, PosReactLocalizer } from "@/components/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub POS",
  description: "CleanHub store POS",
};

const POS_LOCALE_COOKIE_NAME = "cleanhub.pos.locale";

function resolveHtmlLang(locale: string | null): string {
  return locale && isSupportedLocale(locale) ? locale : "zh-CN";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get(POS_LOCALE_COOKIE_NAME)?.value ?? null;
  const htmlLang = resolveHtmlLang(initialLocale);

  return (
    <html lang={htmlLang}>
      <body>
        <PosI18nProvider initialLocale={initialLocale}>
          <PosReactLocalizer>
            {children}
            <Toaster />
          </PosReactLocalizer>
        </PosI18nProvider>
      </body>
    </html>
  );
}
