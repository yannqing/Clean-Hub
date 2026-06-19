import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub POS",
  description: "CleanHub 门店收银系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
