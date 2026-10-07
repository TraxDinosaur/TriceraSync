// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DEMO_COOKIE } from "@/lib/http/auth";

export const metadata = { title: "Unlock" };
export const dynamic = "force-dynamic";

export default async function UnlockPage({ searchParams }) {
  const token = process.env.ACCESS_TOKEN || process.env.DEMO_ACCESS_TOKEN;
  const configured = !!token;
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const unlocked = configured && cookieStore.get(DEMO_COOKIE)?.value === token;

  async function unlock(formData) {
    "use server";
    const expected = process.env.ACCESS_TOKEN || process.env.DEMO_ACCESS_TOKEN;
    if (!expected) redirect("/");
    const given = String(formData.get("token") ?? "").trim();
    if (given !== expected) redirect("/unlock?error=1");
    const c = await cookies();
    c.set(DEMO_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/");
  }

  async function lock() {
    "use server";
    const c = await cookies();
    c.delete(DEMO_COOKIE);
    redirect("/");
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 pt-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Studio access</h1>
        <p className="text-fg-muted text-sm">
          {configured
            ? "An access token is required to create, save, or publish cue sheets on this instance."
            : "No ACCESS_TOKEN configured. In local development, the Studio is open."}
        </p>
      </div>

      {!configured ? (
        <div className="border-border bg-bg-card flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <p className="text-fg-muted">
            The studio is fully unlocked. You can create projects, place cues on the timeline, and
            publish them locally.
          </p>
          <Button href="/" variant="secondary">
            Back to dashboard
          </Button>
        </div>
      ) : unlocked ? (
        <div className="border-border bg-bg-card flex flex-col gap-4 rounded-lg border p-4 text-sm">
          <p className="text-fg">Studio is currently unlocked on this browser.</p>
          <form action={lock}>
            <Button variant="danger" size="sm" type="submit">
              Lock studio
            </Button>
          </form>
        </div>
      ) : (
        <form action={unlock} className="border-border bg-bg-card flex flex-col gap-4 rounded-lg border p-4">
          <Field label="Access token">
            <input
              type="password"
              name="token"
              autoFocus
              required
              className="bg-bg-input border-border focus:border-accent text-fg w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
          </Field>
          {error && <span className="text-danger text-xs">Invalid token. Please try again.</span>}
          <Button type="submit">Unlock</Button>
        </form>
      )}
      <p className="text-fg-muted text-center text-xs">
        <a
          href="https://github.com/TraxDinosaur/TriceraSync"
          target="_blank"
          rel="noreferrer"
          className="hover:text-fg underline underline-offset-4"
        >
          Based on TriceraSync by TraxDinosaur
        </a>
      </p>
    </section>
  );
}
