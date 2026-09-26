// ─── Dexie.js Database ──────────────────────────────────────────────
// IndexedDB persistence for decks via Dexie.

import Dexie, { type Table } from "dexie";
import type { Deck } from "../types";

export class FolioDB extends Dexie {
  decks!: Table<Deck, string>;

  constructor() {
    super("FolioDB");
    this.version(1).stores({
      decks: "id, title, updatedAt",
    });
  }
}

export const db = new FolioDB();

export async function saveDeck(deck: Deck): Promise<void> {
  const existing = await db.decks.get(deck.id);
  if (existing) {
    // Last-write-wins based on updatedAt (handles two-tab scenario)
    if (new Date(deck.updatedAt) >= new Date(existing.updatedAt)) {
      await db.decks.put(deck);
    } else {
      console.warn("Deck was modified more recently in another tab; skipping save.");
    }
  } else {
    await db.decks.put(deck);
  }
}

export async function loadDeck(id: string): Promise<Deck | undefined> {
  return db.decks.get(id);
}

export async function deleteDeck(id: string): Promise<void> {
  await db.decks.delete(id);
}

export async function listDecks(): Promise<Deck[]> {
  return db.decks.orderBy("updatedAt").reverse().toArray();
}
