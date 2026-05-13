import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub POS",
  description: "CleanHub point-of-sale interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
