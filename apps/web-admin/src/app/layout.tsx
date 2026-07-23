import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";

import { AppProviders } from "@/components/providers";
import { ThemeInitializer } from "@/components/theme/theme-initializer";
import { WebAdminLocaleProvider, getWebAdminMessages } from "@/i18n";
import {
  getWebAdminHtmlLang,
  getWebAdminLocaleFromCookies,
} from "@/i18n/locale.server";

import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub Admin",
  description: "CleanHub SaaS administration and back office",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await getWebAdminLocaleFromCookies();
  // Resolve the initial locale's bundle on the server and inject it so the
  // first paint already uses the right copy and the client doesn't have to
  // re-fetch it. Non-default locales are code-split, so this also keeps their
  // catalogs out of the main client chunk unless the user switches locales.
  const initialMessages = await getWebAdminMessages(initialLocale);

  return (
    <html lang={getWebAdminHtmlLang(initialLocale)} suppressHydrationWarning>
      <head>
        <ThemeInitializer />
      </head>
      <body>
        <WebAdminLocaleProvider
          initialLocale={initialLocale}
          initialMessages={initialMessages}
        >
          <AppProviders>{children}</AppProviders>
        </WebAdminLocaleProvider>
        <Toaster />
      </body>
    </html>
  );
}
