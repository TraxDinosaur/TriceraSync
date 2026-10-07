// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { NewProjectForm } from "@/components/projects/NewProjectForm";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="text-fg-muted text-sm">
          Pick where the finalized video lives. Either way, the video itself is never uploaded.
        </p>
      </div>
      <NewProjectForm />
    </section>
  );
}
