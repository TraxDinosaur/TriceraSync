// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { APK_URL, GITHUB_URL } from "@/lib/site";
import { listVideos } from "@/lib/videos/repo";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let projects = [];
  let dbError = null;

  try {
    projects = await listVideos();
  } catch (err) {
    console.error("Dashboard database fetch failed:", err);
    dbError = err.message || "Failed to connect to database.";
  }

  const published = projects.filter((p) => p.status === "published").length;
  const cues = projects.reduce((n, p) => n + (p.cueCount ?? 0), 0);

  return (
    <section className="flex flex-col gap-10">
      <Hero published={published} total={projects.length} cues={cues} hasError={!!dbError} />
      <HowItWorks />

      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Projects
            {projects.length > 0 && (
              <span className="text-fg-muted ml-2 font-sans text-sm font-normal">
                {projects.length}
              </span>
            )}
          </h2>
          {projects.length > 0 && (
            <Button variant="secondary" size="sm" href="/projects/new">
              New project
            </Button>
          )}
        </div>

        {dbError ? (
          <div className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm">
            <strong>Database connection error:</strong> {dbError}
            <div className="text-fg-muted mt-1 text-xs">
              Check DATABASE_URL in the deployment environment. A pooled connection string is
              required on serverless hosts.
            </div>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const CUE_TYPES = [
  { label: "Vibrate", color: "var(--cue-vibrate)" },
  { label: "Flash", color: "var(--cue-flash)" },
  { label: "Brightness", color: "var(--cue-brightness)" },
  { label: "Torch", color: "var(--cue-torch)" },
  { label: "Volume", color: "var(--cue-volume)" },
];

function Hero({ published, total, cues, hasError }) {
  return (
    <div className="border-border bg-bg-elev relative overflow-hidden rounded-3xl border">
      <div aria-hidden className="hero-horns pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden
        className="bg-accent/25 pointer-events-none absolute -top-40 right-[18%] size-[28rem] rounded-full blur-3xl"
      />

      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <span className="text-fg-muted inline-flex w-fit items-center gap-2 rounded-full border border-border bg-bg/60 px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase">
            <LogoMark size={14} />
            TriceraSync Studio
          </span>

          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Feel the <span className="text-accent">video.</span>
          </h1>

          <p className="text-fg-muted max-w-xl text-base sm:text-lg">
            Drop vibration, flash, brightness, torch and volume cues onto a timeline. The
            TriceraSync Engine on your phone performs every one of them, in sync, while you watch
            on YouTube.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button href="/projects/new" className="h-11 px-5 text-[15px]">
              Start a project
            </Button>
            <Button variant="secondary" href="#how" className="h-11 px-5 text-[15px]">
              How it works
            </Button>
            <a
              href={APK_URL}
              className="text-fg-muted hover:text-fg inline-flex h-11 items-center gap-1.5 px-2 text-sm underline-offset-4 hover:underline"
            >
              Get the Engine APK ↗
            </a>
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="Cue types">
            {CUE_TYPES.map((c) => (
              <li
                key={c.label}
                className="border-border bg-bg/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}
                />
                {c.label}
              </li>
            ))}
          </ul>

          {!hasError && (
            <dl className="border-border flex flex-wrap gap-x-10 gap-y-3 border-t pt-5">
              <Stat label="Projects" value={total} />
              <Stat label="Published" value={published} />
              <Stat label="Cues authored" value={cues} />
            </dl>
          )}
        </div>

        <PhoneMock />
      </div>
    </div>
  );
}

/** A CSS-only phone with a live-looking cue firing, so the landing shows the product, not a slogan. */
function PhoneMock() {
  return (
    <div className="relative mx-auto hidden w-[240px] lg:block" aria-hidden>
      <div className="bg-accent/30 absolute inset-x-6 top-10 bottom-10 rounded-full blur-2xl" />
      <div className="border-border/80 relative rounded-[2.4rem] border-[6px] border-[#1c191f] bg-[#08070a] p-3 shadow-[0_30px_80px_-20px_rgba(255,106,42,0.45)]">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#1c191f]" />
        <div className="bg-bg-elev-2 relative aspect-[9/16] overflow-hidden rounded-[1.6rem]">
          {/* faux video frame */}
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_35%,#3a1a0f_0%,#0d0c0f_70%)]" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3 text-[9px] text-white/60">
            <span>9:41</span>
            <span className="text-success">● Engine</span>
          </div>

          {/* firing cue */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="cue-ring bg-accent absolute size-24 rounded-full" />
            <span className="cue-ring bg-accent absolute size-24 rounded-full [animation-delay:0.8s]" />
            <span className="bg-bg/80 border-border relative flex size-20 items-center justify-center rounded-full border backdrop-blur">
              <LogoMark size={40} />
            </span>
          </div>

          {/* mini timeline */}
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-black/50 p-2.5 backdrop-blur">
            {CUE_TYPES.slice(0, 4).map((c, i) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="w-12 text-[8px] text-white/50">{c.label}</span>
                <span className="relative h-1.5 flex-1 rounded-full bg-white/10">
                  <span
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${12 + i * 19}%`,
                      width: `${10 + (i % 2) * 14}%`,
                      background: c.color,
                    }}
                  />
                </span>
              </div>
            ))}
            <div className="mt-0.5 flex items-center justify-between text-[8px] text-white/40">
              <span className="font-mono">00:07.00</span>
              <span className="text-accent">● vibrate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Paste a YouTube link",
    body: "Or point at the file you are about to upload. Only the cue sheet is stored — the video never leaves your browser.",
  },
  {
    n: "02",
    title: "Place cues on the timeline",
    body: "Five lanes, millisecond precision, live preview. Set intensity, ramps and durations per cue.",
  },
  {
    n: "03",
    title: "Publish. Press play.",
    body: "The Engine recognises the video the moment it starts on YouTube and fires every cue on time. Source and APK on GitHub.",
    href: GITHUB_URL,
  },
];

function HowItWorks() {
  return (
    <div id="how" className="scroll-mt-20">
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="border-border bg-bg-elev/70 group relative overflow-hidden rounded-2xl border p-5 transition-colors hover:border-accent/50"
          >
            <span className="text-accent font-display text-3xl font-extrabold tracking-tight opacity-80">
              {s.n}
            </span>
            <h3 className="font-display mt-3 text-lg font-bold tracking-tight">{s.title}</h3>
            <p className="text-fg-muted mt-1.5 text-sm">{s.body}</p>
            {s.href && (
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                github.com/TraxDinosaur ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-fg-muted text-[11px] font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border bg-bg-elev flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
      <LogoMark size={36} />
      <div className="font-display text-base font-bold">No projects yet</div>
      <p className="text-fg-muted max-w-sm text-sm">
        Start one from the video you are about to upload, or from a YouTube link you have already
        published.
      </p>
      <Button href="/projects/new" className="mt-1">
        Create your first project
      </Button>
    </div>
  );
}
