import type { Metadata } from "next";
// Font Source Sans 3 disimpan lokal (dari node_modules), jadi tetap tampil di jaringan LAN tanpa internet.
import "@fontsource-variable/source-sans-3";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spare Part MCC | Philips Industries Batam",
  description: "Sistem pemesanan dan pengelolaan spare part Store MCC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}