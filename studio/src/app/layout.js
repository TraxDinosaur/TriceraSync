// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { GitHubLink } from "@/components/ui/GitHubLink";
import { NavLink } from "@/components/ui/NavLink";
import { ToastViewport } from "@/components/ui/Toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "TriceraSync Studio", template: "%s · TriceraSync" },
  description:
    "Attach vibration, flash, brightness, torch and volume cues to a YouTube video on a timeline — and feel them on your phone while you watch.",
  applicationName: "TriceraSync",
  openGraph: {
    title: "TriceraSync Studio",
    description:
      "Attach vibration, flash, brightness, torch and volume cues to a YouTube video, and feel them on your phone while you watch.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0D0C0F",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="bg-accent text-accent-fg sr-only rounded px-3 py-1 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>

        <header className="border-border bg-bg/80 sticky top-0 z-40 border-b backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-screen-2xl items-center gap-1 px-4">
            <Link href="/" className="mr-4 shrink-0" aria-label="TriceraSync home">
              <Logo />
            </Link>
            <NavLink href="/" exact>
              Projects
            </NavLink>
            <NavLink href="/projects/new">New project</NavLink>
            <span className="ml-auto flex items-center gap-2">
              <GitHubLink className="hidden sm:inline-flex" />
              <NavLink href="/unlock">Unlock</NavLink>
              <span className="border-success/30 bg-success/10 text-success hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex">
                <span className="bg-success size-1.5 animate-pulse rounded-full" aria-hidden />
                Demo
              </span>
            </span>
          </nav>
        </header>

        <main id="main" className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6">
          {children}
        </main>

        <footer className="border-border text-fg-muted mt-8 border-t">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-xs">
            <span className="inline-flex items-center gap-2">
              <LogoMark size={14} /> TriceraSync — cue sheets for YouTube, played back on your phone.
            </span>
            <span className="ml-auto inline-flex items-center gap-3">
              <span>Video never leaves your browser.</span>
              <a
                href="https://github.com/TraxDinosaur/TriceraSync"
                target="_blank"
                rel="noreferrer"
                className="hover:text-fg underline underline-offset-4 transition-colors"
              >
                Based on TriceraSync by TraxDinosaur
              </a>
              <GitHubLink label="Source on GitHub" className="-mr-2.5 text-xs" />
            </span>
          </div>
        </footer>

        <ToastViewport />
      </body>
    </html>
  );
}
