// ─── AI Generation Pipeline ─────────────────────────────────────────
// Server-side proxy call. In production this hits a backend that holds the API key.
// For local dev, we call the proxy server at /api/generate.
// If no provider is configured, we load sample data.

import { v4 as uuidv4 } from "uuid";
import { stringSimilarity } from "string-similarity-js";
import { AIResponseSchema } from "../schemas";
import type { Card, CardType, GenerationSettings } from "../types";
import { FolioError } from "../types";
import type { PDFExtractionResult } from "./pdfProcessor";
import { chunkPages } from "./pdfProcessor";

// ─── Types ──────────────────────────────────────────────────────────

export interface ChunkStatus {
  chunkIndex: number;
  pageRange: string;
  status: "pending" | "processing" | "success" | "failed" | "retrying";
  cards: Card[];
  error?: string;
}

export interface GenerationProgress {
  chunks: ChunkStatus[];
  totalChunks: number;
  completedChunks: number;
  totalCards: number;
}

// ─── Prompt builder ─────────────────────────────────────────────────

function buildPrompt(
  text: string,
  pageNumbers: number[],
  settings: GenerationSettings
): string {
  const cardCountMap = { short: 3, standard: 6, detailed: 10 };
  const targetCount = cardCountMap[settings.targetSize];

  const typeInstructions: Record<CardType, string> = {
    qa: `"type": "qa" — a question on the front, answer on the back.`,
    cloze: `"type": "cloze" — front has a sentence with a key term replaced by "___", back has the complete sentence with the answer.`,
    mcq: `"type": "mcq" — front is a question, back is the correct answer, and "options" is an array of 4 choices (including the correct one).`,
    truefalse: `"type": "truefalse" — front is a statement, back is "True" or "False" with a brief explanation.`,
  };

  const requestedTypes = settings.cardTypes
    .map((t) => typeInstructions[t])
    .join("\n");

  return `You are a flashcard generator. Create exactly ${targetCount} flashcards from the following text.

CARD TYPES TO USE (mix them if multiple are listed):
${requestedTypes}

DIFFICULTY: ${settings.difficulty}
ANSWER LENGTH: ${settings.answerLength}
${settings.topicFocus ? `FOCUS ON TOPIC: ${settings.topicFocus}` : ""}
${settings.topicExclusions?.length ? `EXCLUDE TOPICS: ${settings.topicExclusions.join(", ")}` : ""}
OUTPUT LANGUAGE: ${settings.outputLanguage}

SOURCE PAGES: ${pageNumbers.join(", ")}

RESPOND WITH ONLY A JSON OBJECT in this exact format:
{
  "cards": [
    {
      "type": "<qa|cloze|mcq|truefalse>",
      "front": "<card front text>",
      "back": "<card back text>",
      "options": ["<only for mcq — 4 options>"],
      "sourcePages": [<page numbers from the source>],
      "tags": ["<optional tags>"]
    }
  ]
}

Do NOT include any text outside the JSON object.

TEXT:
${text}`;
}

function buildRetryPrompt(originalPrompt: string, error: string): string {
  return `${originalPrompt}

YOUR PREVIOUS RESPONSE WAS INVALID. Error: ${error}
Please fix the JSON and try again. Return ONLY the corrected JSON object.`;
}

// ─── Provider check ─────────────────────────────────────────────────

export function getProviderInfo(): { available: boolean; name: string } {
  if (typeof localStorage !== "undefined" && localStorage.getItem("folio_gemini_key")) {
    return { available: true, name: "Google Gemini (Client-side API)" };
  }
  const apiBase = import.meta.env.VITE_API_BASE || "";
  if (apiBase) {
    return { available: true, name: "AI Provider (via proxy)" };
  }
  return { available: true, name: "Local Document Intelligence (Private & Offline)" };
}

// ─── AI API Call ────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  const geminiKey = typeof localStorage !== "undefined" ? localStorage.getItem("folio_gemini_key") : null;
  if (geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new FolioError(
        "ProviderUnavailableError",
        `Gemini API returned error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  const apiBase = import.meta.env.VITE_API_BASE;
  if (apiBase) {
    const response = await fetch(`${apiBase}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new FolioError(
        "ProviderUnavailableError",
        `AI provider returned error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.content || data.text || JSON.stringify(data);
  }

  throw new FolioError(
    "ProviderUnavailableError",
    "No remote AI provider configured."
  );
}

// ─── Parse + validate AI response ───────────────────────────────────

function parseAIResponse(
  raw: string,
  allowedPages: number[]
): Card[] {
  // Try to extract JSON from the response
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new FolioError(
      "SchemaValidationError",
      "AI response is not valid JSON."
    );
  }

  const result = AIResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new FolioError(
      "SchemaValidationError",
      `AI response failed validation: ${issues}`
    );
  }

  const now = new Date().toISOString();
  return result.data.cards.map((c) => ({
    ...c,
    id: uuidv4(),
    createdFrom: "ai" as const,
    sourcePages: c.sourcePages.filter((p) => allowedPages.includes(p)),
    createdAt: now,
    updatedAt: now,
    // Ensure sourcePages is non-empty — fallback to first allowed page
    ...(c.sourcePages.filter((p) => allowedPages.includes(p)).length === 0
      ? { sourcePages: [allowedPages[0]] }
      : {}),
  }));
}

// ─── Deduplication ──────────────────────────────────────────────────

function deduplicateCards(cards: Card[]): Card[] {
  const unique: Card[] = [];
  for (const card of cards) {
    const isDuplicate = unique.some(
      (existing) =>
        stringSimilarity(existing.front, card.front) > 0.85 &&
        stringSimilarity(existing.back, card.back) > 0.8
    );
    if (!isDuplicate) {
      unique.push(card);
    }
  }
  return unique;
}

// ─── Main generation function ───────────────────────────────────────

export async function generateCards(
  pdfData: PDFExtractionResult,
  settings: GenerationSettings,
  onProgress: (progress: GenerationProgress) => void
): Promise<{ cards: Card[]; chunkStatuses: ChunkStatus[] }> {
  const startPage = settings.pageRange ? settings.pageRange[0] : 1;
  const endPage = settings.pageRange
    ? settings.pageRange[1]
    : pdfData.pageCount;

  const chunks = chunkPages(pdfData.pages, startPage, endPage);

  if (chunks.length === 0) {
    throw new FolioError(
      "EmptyDocumentError",
      "No text content found in the selected page range."
    );
  }

  const chunkStatuses: ChunkStatus[] = chunks.map((chunk, i) => ({
    chunkIndex: i,
    pageRange: `${chunk[0].pageNumber}–${chunk[chunk.length - 1].pageNumber}`,
    status: "pending",
    cards: [],
  }));

  const progress: GenerationProgress = {
    chunks: chunkStatuses,
    totalChunks: chunks.length,
    completedChunks: 0,
    totalCards: 0,
  };

  onProgress({ ...progress });

  // Process chunks with concurrency cap of 3
  const concurrency = 3;
  let allCards: Card[] = [];

  const processChunk = async (index: number) => {
    const chunk = chunks[index];
    const pageNumbers = chunk.map((p) => p.pageNumber);
    const text = chunk.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");

    chunkStatuses[index].status = "processing";
    onProgress({ ...progress, chunks: [...chunkStatuses] });

    const prompt = buildPrompt(text, pageNumbers, settings);

    let cards: Card[] | null = null;
    let lastError = "";

    // Try up to 2 times (initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const currentPrompt =
          attempt === 0 ? prompt : buildRetryPrompt(prompt, lastError);
        const raw = await callAI(currentPrompt);
        cards = parseAIResponse(raw, pageNumbers);
        break;
      } catch (err) {
        lastError =
          err instanceof FolioError ? err.message : String(err);
        if (attempt === 0) {
          chunkStatuses[index].status = "retrying";
          onProgress({ ...progress, chunks: [...chunkStatuses] });
        }
      }
    }

    if (cards) {
      chunkStatuses[index].status = "success";
      chunkStatuses[index].cards = cards;
      allCards = [...allCards, ...cards];
    } else {
      chunkStatuses[index].status = "failed";
      chunkStatuses[index].error = lastError;
    }

    progress.completedChunks++;
    progress.totalCards = allCards.length;
    onProgress({ ...progress, chunks: [...chunkStatuses] });
  };

  // Execute with concurrency limit
  const queue = [...Array(chunks.length).keys()];
  const executing = new Set<Promise<void>>();

  for (const index of queue) {
    const p = processChunk(index).then(() => {
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  // Deduplicate
  allCards = deduplicateCards(allCards);

  return { cards: allCards, chunkStatuses };
}

// ─── Regenerate single card ─────────────────────────────────────────

export async function regenerateCard(
  card: Card,
  pdfData: PDFExtractionResult,
  settings: GenerationSettings
): Promise<Card> {
  const relevantPages = pdfData.pages.filter((p) =>
    card.sourcePages.includes(p.pageNumber)
  );

  if (relevantPages.length === 0) {
    throw new FolioError(
      "PageRangeError",
      "Source pages for this card have no extractable text."
    );
  }

  const text = relevantPages
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join("\n\n");

  const singleSettings: GenerationSettings = {
    ...settings,
    targetSize: "short", // Just one card
    cardTypes: [card.type],
  };

  const prompt = buildPrompt(
    text,
    card.sourcePages,
    singleSettings
  );

  const raw = await callAI(prompt);
  const cards = parseAIResponse(raw, card.sourcePages);

  if (cards.length === 0) {
    throw new FolioError(
      "SchemaValidationError",
      "AI did not return any valid cards."
    );
  }

  return {
    ...cards[0],
    id: card.id, // Keep same ID
    createdAt: card.createdAt, // Keep original creation time
    updatedAt: new Date().toISOString(),
  };
}

// ─── Retry single chunk ─────────────────────────────────────────────

export async function retryChunk(
  chunkIndex: number,
  pdfData: PDFExtractionResult,
  settings: GenerationSettings,
  startPage: number,
  endPage: number
): Promise<Card[]> {
  const chunks = chunkPages(pdfData.pages, startPage, endPage);
  if (chunkIndex >= chunks.length) {
    throw new FolioError("PageRangeError", "Invalid chunk index.");
  }

  const chunk = chunks[chunkIndex];
  const pageNumbers = chunk.map((p) => p.pageNumber);
  const text = chunk
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join("\n\n");

  const prompt = buildPrompt(text, pageNumbers, settings);
  const raw = await callAI(prompt);
  return parseAIResponse(raw, pageNumbers);
}
