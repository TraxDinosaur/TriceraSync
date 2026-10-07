# TriceraSync Cue Format (PCF v1) Specification

## Overview

The Physical Cue Format (PCF v1) is an open, JSON-based format for synchronizing physical device cues (haptics, screen flash, display brightness, camera torch, and audio volume) with video playback on client devices.

PCF documents are self-contained and transport-independent. They describe effects across a timeline in milliseconds relative to the start of a video (0 ms).

---

## Document Structure

A valid PCF v1 document contains the following root keys:

```json
{
  "version": 1,
  "video": {
    "provider": "youtube",
    "id": "0PBvTTpnTwI",
    "title": "TriceraSync Test Video 1",
    "channel": "TraxDinosaur",
    "durationMs": 11000
  },
  "meta": {
    "sheetVersion": 1,
    "createdAt": "2026-09-11T12:00:00.000Z",
    "fps": 30
  },
  "defaults": {
    "restoreOnEnd": true,
    "toleranceMs": 120
  },
  "cues": []
}
```

### Root Fields

| Field | Type | Description |
|---|---|---|
| `version` | `integer` | Must be `1`. |
| `video` | `object` | Metadata about the associated video. |
| `video.provider` | `string` | Video provider identifier (`youtube`). |
| `video.id` | `string \| null` | Canonical video ID. |
| `video.title` | `string \| null` | Original video title. |
| `video.channel` | `string \| null` | Channel or creator name. |
| `video.durationMs` | `integer \| null` | Canonical duration in milliseconds. |
| `meta` | `object` | Document metadata. |
| `meta.sheetVersion`| `integer` | Monotonic version integer (`>= 1`). |
| `meta.createdAt` | `string` | ISO 8601 creation timestamp. |
| `meta.fps` | `number` | Optional authoring frame rate (e.g. `24`, `30`, `60`). |
| `defaults` | `object` | Playback defaults. |
| `defaults.restoreOnEnd` | `boolean` | Revert hardware state when playback stops (default: `true`). |
| `defaults.toleranceMs` | `integer` | Maximum timing skew before seek re-sync (default: `120`). |
| `cues` | `array` | Chronologically sorted array of Cue objects. |

---

## Cue Object

Every cue in the `cues` array must have:

```json
{
  "id": "c_a1",
  "at": 210,
  "durationMs": 200,
  "type": "vibrate",
  "params": {}
}
```

- `id` (`string`): Unique identifier matching `/^c_[A-Za-z0-9]{2,}$/`.
- `at` (`integer >= 0`): Timestamp in milliseconds from video start. Cues must be strictly sorted by `at`.
- `durationMs` (`integer >= 0`, optional): Effective duration for state cues or waveform holds.
- `type` (`string`): One of `vibrate`, `flash`, `brightness`, `torch`, `volume`.
- `params` (`object`): Parameters specific to `type`.

---

## Cue Types and Parameters

### 1. `vibrate` (Instant Cue)

Triggers physical device haptics. Supports three modes:

#### Mode: `oneShot`
```json
{
  "mode": "oneShot",
  "durationMs": 200,
  "amplitude": 255
}
```
- `durationMs` (`10` to `10000`): Duration of pulse in milliseconds.
- `amplitude` (`1` to `255`, default `255`): Vibration strength.

#### Mode: `waveform`
```json
{
  "mode": "waveform",
  "timings": [0, 100, 50, 100],
  "amplitudes": [0, 200, 0, 255],
  "repeat": -1
}
```
- `timings` (`array of int >= 0`): Timing intervals (ms). Length 1 to 64.
- `amplitudes` (`array of int 0..255`): Amplitudes for each timing segment. Must match length of `timings`.
- `repeat` (`int`, default `-1`): Loop index, or `-1` for no repeat.

#### Mode: `predefined`
```json
{
  "mode": "predefined",
  "effect": "HEAVY_CLICK"
}
```
- `effect`: One of `CLICK`, `DOUBLE_CLICK`, `HEAVY_CLICK`, `TICK`.

---

### 2. `flash` (Instant Cue)

Displays a transient full-screen color flash over the display.

```json
{
  "color": "#FF0000",
  "opacity": 0.6,
  "durationMs": 150,
  "fadeOutMs": 150
}
```

- `color` (`string`): Hex color `#RRGGBB`.
- `opacity` (`number 0..1`, default `0.6`): Maximum flash opacity.
- `durationMs` (`int 16..5000`): Hold duration before fade.
- `fadeOutMs` (`int >= 0`, default `0`): Fade-out transition duration in milliseconds.

---

### 3. `brightness` (State Cue)

Modulates device screen backlight level.

```json
{
  "level": 0.3,
  "rampMs": 100
}
```

- `level` (`number 0..1`): Target display brightness (`0.0` min to `1.0` max).
- `rampMs` (`int >= 0`, default `0`): Linear ramp duration in milliseconds.

---

### 4. `torch` (State Cue)

Controls the rear camera LED / flashlight.

```json
{
  "on": true,
  "durationMs": 1500,
  "strength": 1.0
}
```

- `on` (`boolean`): Whether torch is illuminated.
- `durationMs` (`int 16..30000`, optional): Auto-off duration if set.
- `strength` (`number 0..1`, default `1.0`): Torch intensity on supported Camera2 hardware.

---

### 5. `volume` (State Cue)

Adjusts media audio playback volume.

```json
{
  "level": 0.2,
  "rampMs": 200
}
```

- `level` (`number 0..1`): Target media volume level.
- `rampMs` (`int >= 0`, default `0`): Fade ramp duration in milliseconds.

---

## Firing Rules and Synchronization

1. **Instant Cues (`vibrate`, `flash`)**:
   - Fired once when the playback position transitions across the cue's `at` timestamp.
   - If a forward seek jumps over instant cues, they are dropped (never replayed in a batch).
   - If playback seeks backward, instant cues re-arm for subsequent forward playback.

2. **State Cues (`brightness`, `volume`, `torch`)**:
   - Persist until overwritten by a subsequent cue of the same type, or until their duration expires.
   - On seeking to any point in the video, the active state is evaluated by finding the most recent state cue of each type prior to the playhead position.

3. **Position Extrapolation**:
   - Video position between MediaSession callbacks is calculated as:
     ```
     pos(now) = position + (now - lastPositionUpdateTime) * speed     (while PLAYING)
     pos(now) = position                                              (otherwise)
     ```
   - Clock timebase must use monotonic elapsed realtime to prevent system clock adjustments from disturbing sync.

4. **Hardware Baseline Restoration**:
   - Actuators capture system baselines (current brightness, volume, torch off) when a sync session starts.
   - When playback stops, pauses, or terminates, baseline values are immediately restored.

---

## Video Matching

YouTube does not expose raw video IDs through standard Android MediaSession APIs. Videos are identified using normalized title and channel matching within a duration tolerance window:

- Match tuple: `(normalize(title), normalize(channel), durationMs +/- 1500 ms)`
- Normalization:
  - Unicode NFKC normalization
  - Case folded to lowercase
  - Removal of invisible characters and formatting controls
  - Replacement of punctuation, emojis, and symbols with spaces
  - Whitespace collapsed and trimmed
