import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const barlow = Barlow_Condensed({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-barlow" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "PsycheEngine",
  description: "Warehouse documents written from one canon of facts, checked against a plain-model baseline.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-concrete font-sans text-ink antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
