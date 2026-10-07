// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { PlayerAdapter, clampMs } from "./PlayerAdapter.js";

/** How long the audio keeps running after the last scrub step. */
const SCRUB_BURST_MS = 130;

/**
 * Wraps an HTMLVideoElement fed by an object URL. Uses requestVideoFrameCallback for
 * frame-accurate media time when available, otherwise rAF-polls currentTime (FR-06).
 */
export class LocalPlayerAdapter extends PlayerAdapter {
  /** @type {HTMLVideoElement} */
  #video;
  #raf = 0;
  #rvfc = 0;
  #scrubTimer = 0;
  #disposers = [];

  constructor(videoEl) {
    super();
    this.#video = videoEl;
    const v = videoEl;
    const listen = (ev, fn) => {
      v.addEventListener(ev, fn);
      this.#disposers.push(() => v.removeEventListener(ev, fn));
    };
    listen("loadedmetadata", () => {
      this.emit("duration", this.durationMs());
      this.emit("ready", { durationMs: this.durationMs() });
    });
    listen("durationchange", () => this.emit("duration", this.durationMs()));
    listen("play", () => {
      this.emit("play");
      this.#startTicking();
    });
    listen("pause", () => {
      this.#stopTicking();
      this.emit("time", this.currentTimeMs());
      this.emit("pause");
    });
    listen("ended", () => {
      this.#stopTicking();
      this.emit("ended");
    });
    listen("seeked", () => {
      const t = this.currentTimeMs();
      this.emit("time", t);
      this.emit("seeked", t);
    });
    listen("error", () => this.emit("error", new Error("video element error")));
    if (v.readyState >= 1) {
      queueMicrotask(() => this.emit("ready", { durationMs: this.durationMs() }));
    }
  }

  #startTicking() {
    this.#stopTicking();
    const v = this.#video;
    if (typeof v.requestVideoFrameCallback === "function") {
      const onFrame = (_now, meta) => {
        this.emit("time", Math.round(meta.mediaTime * 1000));
        this.#rvfc = v.requestVideoFrameCallback(onFrame);
      };
      this.#rvfc = v.requestVideoFrameCallback(onFrame);
    } else {
      const tick = () => {
        this.emit("time", this.currentTimeMs());
        this.#raf = requestAnimationFrame(tick);
      };
      this.#raf = requestAnimationFrame(tick);
    }
  }

  #stopTicking() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    if (this.#rvfc && typeof this.#video.cancelVideoFrameCallback === "function") {
      this.#video.cancelVideoFrameCallback(this.#rvfc);
    }
    this.#raf = this.#rvfc = 0;
  }

  play() {
    this.#video.play().catch((e) => this.emit("error", e));
  }
  pause() {
    this.#video.pause();
  }
  seek(ms) {
    this.#video.currentTime = clampMs(ms, this.durationMs()) / 1000;
  }
  scrub(ms, audible = false) {
    const wasPlaying = this.isPlaying();
    this.seek(ms);
    if (!audible || wasPlaying) return;
    // Keep the burst alive while the user keeps stepping; each scrub re-arms the pause.
    clearTimeout(this.#scrubTimer);
    this.#video.play().catch(() => {});
    this.#scrubTimer = setTimeout(() => this.#video.pause(), SCRUB_BURST_MS);
  }
  currentTimeMs() {
    return Math.round(this.#video.currentTime * 1000);
  }
  durationMs() {
    const d = this.#video.duration;
    return Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : null;
  }
  isPlaying() {
    return !this.#video.paused && !this.#video.ended;
  }
  setVolume(level) {
    this.#video.volume = Math.max(0, Math.min(1, level));
  }
  setRate(rate) {
    this.#video.playbackRate = rate;
  }
  destroy() {
    clearTimeout(this.#scrubTimer);
    this.#stopTicking();
    this.#disposers.forEach((d) => d());
    this.#disposers = [];
    super.destroy();
  }
}
