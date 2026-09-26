// ─── CSV Export ─────────────────────────────────────────────────────
// Correctly handles commas, quotes, and embedded newlines per RFC 4180.

import type { Card } from "../types";
import { FolioError } from "../types";

function escapeCSVField(field: string): string {
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

export function generateCSV(cards: Card[], deckTitle: string): string {
  const headers = ["Type", "Front", "Back", "Source Pages", "Deck Title"];
  const rows = cards.map((card) => [
    escapeCSVField(card.type),
    escapeCSVField(card.front),
    escapeCSVField(card.back),
    escapeCSVField(card.sourcePages.join("; ")),
    escapeCSVField(deckTitle),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function downloadCSV(csvContent: string, fileName: string): void {
  try {
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    throw new FolioError(
      "ExportError",
      "Failed to export CSV. Please try again.",
      err
    );
  }
}
