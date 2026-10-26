import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PsycheEngine — consistent warehouse manuals",
  description:
    "Dashboard for the PsycheEngine multi-agent manual writer: canon, document, benchmark charts and agent log.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
