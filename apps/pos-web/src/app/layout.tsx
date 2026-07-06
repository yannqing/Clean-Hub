import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";
import { cookies } from "next/headers";

import { PosDomLocalizer, PosI18nProvider } from "@/components/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub POS",
  description: "CleanHub store POS",
};

const POS_LOCALE_COOKIE_NAME = "cleanhub.pos.locale";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get(POS_LOCALE_COOKIE_NAME)?.value ?? null;

  return (
    <html lang="zh-CN">
      <body>
        <PosI18nProvider initialLocale={initialLocale}>
          <PosDomLocalizer />
          {children}
          <Toaster />
        </PosI18nProvider>
      </body>
    </html>
  );
}
