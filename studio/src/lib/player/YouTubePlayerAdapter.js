// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { PlayerAdapter, clampMs } from "./PlayerAdapter.js";

const API_SRC = "https://www.youtube.com/iframe_api";
/** How long the audio keeps running after the last scrub step. */
const SCRUB_BURST_MS = 130;
let apiPromise = null;

/** Loads the IFrame API once per page and resolves with the global `YT` namespace. */
export function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => reject(new Error("failed to load YouTube IFrame API"));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * Wraps a YT.Player. Time is rAF-polled from getCurrentTime() while playing (FR-06).
 * Construct with an empty container element; the IFrame replaces it.
 */
export class YouTubePlayerAdapter extends PlayerAdapter {
  #player = null;
  #raf = 0;
  #scrubTimer = 0;
  #ready = false;
  #duration = null;
  #destroyed = false;

  constructor(containerEl, videoId) {
    super();
    loadYouTubeApi()
      .then((YT) => {
        if (this.#destroyed) return;
        this.#player = new YT.Player(containerEl, {
          videoId,
          playerVars: {
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.#ready = true;
              this.#duration = Math.round(this.#player.getDuration() * 1000) || null;
              this.emit("duration", this.#duration);
              this.emit("ready", { durationMs: this.#duration });
            },
            onStateChange: (e) => this.#onState(YT, e.data),
            onError: (e) => this.emit("error", new Error(`YouTube player error ${e.data}`)),
          },
        });
      })
      .catch((e) => this.emit("error", e));
  }

  #onState(YT, state) {
    if (state === YT.PlayerState.PLAYING) {
      if (!this.#duration) {
        this.#duration = Math.round(this.#player.getDuration() * 1000) || null;
        if (this.#duration) this.emit("duration", this.#duration);
      }
      this.emit("play");
      this.#startTicking();
    } else if (state === YT.PlayerState.PAUSED) {
      this.#stopTicking();
      this.emit("time", this.currentTimeMs());
      this.emit("pause");
    } else if (state === YT.PlayerState.ENDED) {
      this.#stopTicking();
      this.emit("ended");
    }
  }

  #startTicking() {
    this.#stopTicking();
    const tick = () => {
      this.emit("time", this.currentTimeMs());
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }
  #stopTicking() {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  play() {
    if (this.#ready) this.#player.playVideo();
  }
  pause() {
    if (this.#ready) this.#player.pauseVideo();
  }
  seek(ms) {
    if (!this.#ready) return;
    const t = clampMs(ms, this.#duration);
    this.#player.seekTo(t / 1000, true);
    // The IFrame API has no seeked event; report the target so the UI stays in sync.
    this.emit("time", t);
    this.emit("seeked", t);
  }
  scrub(ms, audible = false) {
    const wasPlaying = this.isPlaying();
    this.seek(ms);
    if (!audible || wasPlaying || !this.#ready) return;
    clearTimeout(this.#scrubTimer);
    this.#player.playVideo();
    this.#scrubTimer = setTimeout(() => this.#player?.pauseVideo(), SCRUB_BURST_MS);
  }
  currentTimeMs() {
    return this.#ready ? Math.round(this.#player.getCurrentTime() * 1000) : 0;
  }
  durationMs() {
    return this.#duration;
  }
  isPlaying() {
    return this.#ready && this.#player.getPlayerState() === 1;
  }
  setVolume(level) {
    if (this.#ready) this.#player.setVolume(Math.round(Math.max(0, Math.min(1, level)) * 100));
  }
  setRate(rate) {
    if (this.#ready) this.#player.setPlaybackRate(rate);
  }
  destroy() {
    this.#destroyed = true;
    clearTimeout(this.#scrubTimer);
    this.#stopTicking();
    try {
      this.#player?.destroy();
    } catch {
      // player may already be gone
    }
    this.#player = null;
    super.destroy();
  }
}
