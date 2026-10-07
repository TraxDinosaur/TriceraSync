// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

import { JsonFileStorage } from "./JsonFileStorage.js";

/**
 * StorageAdapter interface contract.
 *
 * To plug in a private production database (e.g. PostgreSQL/Neon):
 * 1. Implement this interface in a class (e.g. `PostgresStorage.js`).
 * 2. Set the environment variable `STORAGE_ADAPTER=postgres`.
 * 3. The studio automatically delegates all operations to your custom adapter.
 */

let instance = null;

export function getStorage() {
  if (instance) return instance;

  const adapter = process.env.STORAGE_ADAPTER?.toLowerCase();
  if (adapter === "postgres" || adapter === "postgresql") {
    try {
      // Dynamic runtime import to allow custom adapter without static bundling
      // eslint-disable-next-line no-eval
      const mod = eval("require")("./PostgresStorage.js");
      instance = new mod.PostgresStorage();
      return instance;
    } catch {
      throw new Error(
        "PostgreSQL adapter is not included in this repository. See studio/docs/STORAGE.md for details.",
      );
    }
  }

  instance = new JsonFileStorage(process.env.STORAGE_FILE);
  return instance;
}

export { JsonFileStorage };
