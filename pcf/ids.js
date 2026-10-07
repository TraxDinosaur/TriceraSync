const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generates a cue id like `c_k3x9qz` (6 chars ≈ 2.2e9 combinations). */
export function newCueId(size = 6) {
  let out = "c_";
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
