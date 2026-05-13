import type { Metadata } from "next";
import { Toaster } from "@cleanhub/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub Admin",
  description: "CleanHub SaaS administration and back office",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
