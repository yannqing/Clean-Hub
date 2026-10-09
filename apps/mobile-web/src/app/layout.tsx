import type { Metadata, Viewport } from "next";
import { Toaster } from "@cleanhub/ui";

import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { MobileUpdateRequired } from "@/components/mobile-update-required";

import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub Mobile",
  description: "Espace mobile CleanHub pour clients, livreurs et owners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <MobileI18nProvider>
          {children}
          <MobileUpdateRequired />
          <Toaster />
        </MobileI18nProvider>
      </body>
    </html>
  );
}
