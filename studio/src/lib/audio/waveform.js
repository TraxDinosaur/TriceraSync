// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

// Downsample raw audio PCM channel data into normalized 0..1 peaks.
// ponytail: mono channel 0 downsampling; upgrade to multi-channel mixdown if stereo panning visual is needed.
export function computePeaks(channelData, durationSec, peaksPerSec = 50) {
  if (!channelData || channelData.length === 0 || durationSec <= 0) {
    return new Float32Array(0);
  }
  const totalPeaks = Math.max(1, Math.ceil(durationSec * peaksPerSec));
  const blockSize = Math.max(1, Math.floor(channelData.length / totalPeaks));
  const peaks = new Float32Array(totalPeaks);

  let globalMax = 0;
  for (let i = 0; i < totalPeaks; i++) {
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks[i] = max;
    if (max > globalMax) globalMax = max;
  }

  if (globalMax > 0) {
    for (let i = 0; i < totalPeaks; i++) {
      peaks[i] = peaks[i] / globalMax;
    }
  }

  return peaks;
}
