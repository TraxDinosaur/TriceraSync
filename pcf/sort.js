/** Returns a new array sorted by `at`, then by id for a stable order. */
export function sortCues(cues) {
  return [...cues].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
