// ─── Schema Migration ───────────────────────────────────────────────
// Bumps schemaVersion on breaking shape changes.
// Each migration transforms from version N to N+1.

import type { Deck } from "../types";
import { CURRENT_SCHEMA_VERSION } from "../types";

type MigrationFn = (deck: unknown) => unknown;

// Registry of migrations: key = source version, value = transform to next version
const migrations: Record<number, MigrationFn> = {
  // Example: when schemaVersion 2 is introduced, add:
  // 1: (deck: any) => ({ ...deck, schemaVersion: 2, newField: defaultValue }),
};

export function migrateDeck(raw: unknown): Deck {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deck = raw as any;

  if (typeof deck !== "object" || deck === null) {
    throw new Error("Invalid deck data: not an object");
  }

  // If no schema version, assume version 1
  if (!deck.schemaVersion) {
    deck.schemaVersion = 1;
  }

  // Apply migrations sequentially
  while (deck.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[deck.schemaVersion];
    if (!migration) {
      throw new Error(
        `No migration available from schema version ${deck.schemaVersion} to ${deck.schemaVersion + 1}`
      );
    }
    deck = migration(deck);
  }

  return deck as Deck;
}

export function needsMigration(schemaVersion: number): boolean {
  return schemaVersion < CURRENT_SCHEMA_VERSION;
}
