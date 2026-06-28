import type { Metadata, Viewport } from "next";
import { Toaster } from "@cleanhub/ui";

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
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <MobileUpdateRequired />
        <Toaster />
      </body>
    </html>
  );
}
