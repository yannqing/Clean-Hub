import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";

import { WebAdminLocaleProvider } from "@/i18n";
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

  return (
    <html lang={getWebAdminHtmlLang(initialLocale)}>
      <body>
        <WebAdminLocaleProvider initialLocale={initialLocale}>
          {children}
        </WebAdminLocaleProvider>
        <Toaster />
      </body>
    </html>
  );
}
