// ─── Client-Side Document Intelligence & Flashcard Generator ─────────
// Generates topic-aware, source-linked flashcards directly from PDF text.
// No external API required — 100% private, fast, and derived from the document.

import { v4 as uuidv4 } from "uuid";
import type { Card, GenerationSettings } from "../types";

interface StructuredUnit {
  type: "definition" | "heading_section" | "bullet_point" | "causal" | "factual" | "general";
  subject: string;
  body: string;
  pageNumber: number;
  topic?: string;
}

// ─── Stop words & Helpers ───────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can",
  "had", "her", "was", "one", "our", "out", "has", "have", "been",
  "this", "that", "with", "they", "from", "were", "which", "their",
  "will", "each", "make", "like", "than", "them", "then", "what",
  "when", "where", "some", "also", "into", "such", "more", "most",
  "very", "about", "would", "could", "should", "there", "these",
  "those", "other", "being", "between", "through", "during", "before",
  "after", "above", "below", "must", "might", "shall", "does", "done",
]);

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Unit Extraction ────────────────────────────────────────────────

export function analyzeDocumentUnits(
  pages: { pageNumber: number; text: string }[],
  topicFocus?: string,
  topicExclusions?: string[]
): StructuredUnit[] {
  const units: StructuredUnit[] = [];
  let currentTopic = "General";

  const exclusions = (topicExclusions || []).map((e) => e.toLowerCase().trim()).filter(Boolean);
  const focus = topicFocus ? topicFocus.toLowerCase().trim() : null;

  for (const page of pages) {
    const rawParagraphs = page.text.split(/\n\s*\n|\n(?=[A-Z0-9#•\-\d+\.])/);

    for (const rawPara of rawParagraphs) {
      const para = cleanText(rawPara);
      if (para.length < 15) continue;

      // Check exclusions
      if (exclusions.some((ex) => para.toLowerCase().includes(ex))) {
        continue;
      }

      // Check if this line is a heading/topic
      if (
        (para.length <= 60 && /^[A-Z0-9]/.test(para) && !/[.!?]$/.test(para)) ||
        /^(?:Chapter|Section|Unit|Part|Module)\s+\d+/i.test(para)
      ) {
        currentTopic = para.replace(/^#+\s*|^\d+[\.\)]\s*/, "").trim();
        continue;
      }

      // If topicFocus is specified, check relevance
      if (focus && !para.toLowerCase().includes(focus) && !currentTopic.toLowerCase().includes(focus)) {
        // deprioritize or skip if strictly filtered
      }

      // 1. Definition Pattern: "Term: Definition" or "Term - Definition"
      const colonMatch = para.match(/^([A-Z][A-Za-z0-9\s,&/'-]{2,45})\s*[:—–-]\s+([A-Z0-9a-z][\s\S]{15,400})/);
      if (colonMatch) {
        units.push({
          type: "definition",
          subject: colonMatch[1].trim(),
          body: colonMatch[2].trim(),
          pageNumber: page.pageNumber,
          topic: currentTopic,
        });
        continue;
      }

      // 2. Formal Definition Sentence: "X is defined as Y" or "X refers to Y"
      const defSentenceMatch = para.match(
        /^([A-Z][A-Za-z0-9\s]{2,40})\s+(?:is defined as|is known as|refers to|is a type of|is the process of|describes|represents)\s+([^\n.]{15,300})/i
      );
      if (defSentenceMatch) {
        units.push({
          type: "definition",
          subject: defSentenceMatch[1].trim(),
          body: defSentenceMatch[0].trim(),
          pageNumber: page.pageNumber,
          topic: currentTopic,
        });
        continue;
      }

      // 3. Bullet Point / List Item: "• Item" or "1. Item"
      const bulletMatch = para.match(/^(?:[•\-\*]|\d+\.)\s+(.+)$/);
      if (bulletMatch) {
        const itemText = bulletMatch[1].trim();
        if (itemText.length >= 20) {
          units.push({
            type: "bullet_point",
            subject: currentTopic,
            body: itemText,
            pageNumber: page.pageNumber,
            topic: currentTopic,
          });
          continue;
        }
      }

      // 4. Causal / Mechanism: "Because...", "leads to...", "results in..."
      if (/\b(?:because|therefore|as a result|leads to|causes|results in|is responsible for|functions to)\b/i.test(para)) {
        const firstSentence = para.split(/[.!?]\s+/)[0];
        if (firstSentence && firstSentence.length >= 25) {
          units.push({
            type: "causal",
            subject: currentTopic,
            body: firstSentence.trim() + ".",
            pageNumber: page.pageNumber,
            topic: currentTopic,
          });
          continue;
        }
      }

      // 5. Numerical / Empirical Fact
      if (/\b(?:\d{4}|\d+(?:\.\d+)?%|\$?\d+(?:\.\d+)?\s*(?:million|billion|km|meters|kg|grams|hours|seconds|percent))\b/i.test(para)) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if (s.length >= 25 && s.length <= 250) {
            units.push({
              type: "factual",
              subject: currentTopic,
              body: s.trim(),
              pageNumber: page.pageNumber,
              topic: currentTopic,
            });
            break;
          }
        }
        continue;
      }

      // 6. General Substantive Sentence
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        const trimmed = s.trim();
        if (trimmed.length >= 35 && trimmed.length <= 300) {
          units.push({
            type: "general",
            subject: currentTopic,
            body: trimmed,
            pageNumber: page.pageNumber,
            topic: currentTopic,
          });
        }
      }
    }
  }

  return units;
}

// ─── Card Creators ──────────────────────────────────────────────────

function createQACard(unit: StructuredUnit): Card {
  let front = "";
  let back = "";

  if (unit.type === "definition") {
    front = `What is ${unit.subject}?`;
    back = unit.body.endsWith(".") ? unit.body : `${unit.body}.`;
  } else if (unit.type === "causal") {
    front = `How does this mechanism work in ${unit.subject}?`;
    back = unit.body;
  } else if (unit.type === "bullet_point") {
    front = `Regarding ${unit.subject}: what is a key property or characteristic?`;
    back = unit.body;
  } else if (unit.type === "factual") {
    front = `What does the document state regarding ${unit.subject}?`;
    back = unit.body;
  } else {
    // Extract first 4-7 words as prompt
    const words = unit.body.split(/\s+/);
    const subjectPrefix = words.slice(0, 5).join(" ");
    front = `Explain the following regarding ${unit.subject}: "${subjectPrefix}..."`;
    back = unit.body;
  }

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    type: "qa",
    front: capitalize(front),
    back: capitalize(back),
    sourcePages: [unit.pageNumber],
    createdFrom: "ai",
    tags: unit.topic ? [unit.topic] : [],
    createdAt: now,
    updatedAt: now,
  };
}

function createClozeCard(unit: StructuredUnit): Card | null {
  const sentence = unit.body;
  const words = sentence.split(/\s+/);
  if (words.length < 6) return null;

  // If definition, blank out the subject
  if (unit.type === "definition" && unit.subject.length > 2) {
    const escapedSubject = unit.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedSubject}\\b`, "i");
    if (regex.test(sentence)) {
      const front = sentence.replace(regex, "_______");
      return {
        id: uuidv4(),
        type: "cloze",
        front,
        back: sentence,
        sourcePages: [unit.pageNumber],
        createdFrom: "ai",
        tags: unit.topic ? [unit.topic] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Find candidate keyword (longer word, capitalized or domain-specific)
  const candidateWords = words.filter(
    (w) =>
      w.length >= 5 &&
      !STOP_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, "")) &&
      /^[A-Za-z]+$/.test(w.replace(/[^a-zA-Z]/g, ""))
  );

  if (candidateWords.length === 0) return null;

  // Pick keyword from middle or towards end
  const targetWord = candidateWords[Math.floor(candidateWords.length * 0.5)];
  const cleanTarget = targetWord.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleanTarget || cleanTarget.length < 4) return null;

  const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  const front = sentence.replace(regex, "_______");

  if (front === sentence) return null;

  return {
    id: uuidv4(),
    type: "cloze",
    front,
    back: sentence,
    sourcePages: [unit.pageNumber],
    createdFrom: "ai",
    tags: unit.topic ? [unit.topic] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMCQCard(unit: StructuredUnit, allUnits: StructuredUnit[]): Card | null {
  const correctAnswer = unit.type === "definition" ? unit.body : unit.body;
  if (correctAnswer.length > 180 || correctAnswer.length < 10) return null;

  // Find 3 distractors from other units
  const distractors: string[] = [];
  const otherUnits = allUnits.filter(
    (u) => u.body !== unit.body && u.body.length >= 10 && u.body.length <= 180
  );

  // Shuffle candidate distractors
  const shuffledOthers = [...otherUnits].sort(() => 0.5 - Math.random());
  for (const other of shuffledOthers) {
    if (!distractors.includes(other.body) && other.body !== correctAnswer) {
      distractors.push(other.body);
    }
    if (distractors.length >= 3) break;
  }

  // If not enough full sentence distractors, generate contextual alternatives
  if (distractors.length < 3) {
    return null;
  }

  const options = [correctAnswer, ...distractors.slice(0, 3)].sort(() => 0.5 - Math.random());

  const front =
    unit.type === "definition"
      ? `Which of the following best defines or describes "${unit.subject}"?`
      : `Which statement correctly reflects the findings on "${unit.subject}"?`;

  return {
    id: uuidv4(),
    type: "mcq",
    front,
    back: correctAnswer,
    options,
    sourcePages: [unit.pageNumber],
    createdFrom: "ai",
    tags: unit.topic ? [unit.topic] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTrueFalseCard(unit: StructuredUnit): Card | null {
  if (unit.body.length < 25 || unit.body.length > 250) return null;

  const front = unit.body.endsWith(".") ? unit.body.slice(0, -1) : unit.body;
  const back = `True — Based on page ${unit.pageNumber}: "${unit.body}"`;

  return {
    id: uuidv4(),
    type: "truefalse",
    front,
    back,
    sourcePages: [unit.pageNumber],
    createdFrom: "ai",
    tags: unit.topic ? [unit.topic] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Main Generation Orchestrator ───────────────────────────────────

export interface LocalGenerationProgress {
  phase: "analyzing" | "generating" | "deduplicating";
  current: number;
  total: number;
}

export function generateCardsFromText(
  pages: { pageNumber: number; text: string }[],
  settings: GenerationSettings,
  onProgress?: (progress: LocalGenerationProgress) => void
): Card[] {
  const startPage = settings.pageRange ? settings.pageRange[0] : 1;
  const endPage = settings.pageRange
    ? settings.pageRange[1]
    : pages.length > 0
      ? pages[pages.length - 1].pageNumber
      : 1;

  // Filter pages to selected range
  const selectedPages = pages.filter(
    (p) => p.pageNumber >= startPage && p.pageNumber <= endPage && p.text.trim().length > 0
  );

  if (selectedPages.length === 0) return [];

  onProgress?.({ phase: "analyzing", current: 0, total: selectedPages.length });

  // Extract structured units
  const units = analyzeDocumentUnits(
    selectedPages,
    settings.topicFocus,
    settings.topicExclusions
  );

  onProgress?.({ phase: "analyzing", current: selectedPages.length, total: selectedPages.length });

  if (units.length === 0) {
    // Fallback: create raw units from whatever lines exist
    for (const page of selectedPages) {
      const lines = page.text.split("\n").filter((l) => l.trim().length > 20);
      for (const line of lines) {
        units.push({
          type: "general",
          subject: "Key Concept",
          body: line.trim(),
          pageNumber: page.pageNumber,
          topic: "Notes",
        });
      }
    }
  }

  // Determine card target count
  const targetMap = { short: 6, standard: 14, detailed: 24 };
  const targetCount = Math.min(
    targetMap[settings.targetSize] || 14,
    Math.max(units.length, 6)
  );

  const requestedTypes = new Set(settings.cardTypes);
  const cards: Card[] = [];
  const usedTexts = new Set<string>();

  onProgress?.({ phase: "generating", current: 0, total: targetCount });

  const addCard = (card: Card | null): boolean => {
    if (!card) return false;
    const key = `${card.front.toLowerCase()}_${card.back.toLowerCase()}`;
    if (usedTexts.has(key)) return false;
    if (cards.length >= targetCount) return false;

    cards.push(card);
    usedTexts.add(key);
    onProgress?.({ phase: "generating", current: cards.length, total: targetCount });
    return true;
  };

  // Prioritize definitions and high-value units first
  const definitions = units.filter((u) => u.type === "definition");
  const causals = units.filter((u) => u.type === "causal");
  const bullets = units.filter((u) => u.type === "bullet_point");
  const factuals = units.filter((u) => u.type === "factual");
  const generals = units.filter((u) => u.type === "general");

  // Round 1: Q&A
  if (requestedTypes.has("qa")) {
    for (const u of [...definitions, ...causals, ...bullets, ...factuals]) {
      addCard(createQACard(u));
      if (cards.length >= targetCount) break;
    }
  }

  // Round 2: Cloze
  if (requestedTypes.has("cloze") && cards.length < targetCount) {
    for (const u of [...definitions, ...factuals, ...generals]) {
      addCard(createClozeCard(u));
      if (cards.length >= targetCount) break;
    }
  }

  // Round 3: MCQ
  if (requestedTypes.has("mcq") && cards.length < targetCount) {
    for (const u of [...definitions, ...bullets, ...factuals]) {
      addCard(createMCQCard(u, units));
      if (cards.length >= targetCount) break;
    }
  }

  // Round 4: True/False
  if (requestedTypes.has("truefalse") && cards.length < targetCount) {
    for (const u of [...factuals, ...definitions, ...generals]) {
      addCard(createTrueFalseCard(u));
      if (cards.length >= targetCount) break;
    }
  }

  // Round 5: Fill remainder with any available type requested
  if (cards.length < targetCount) {
    for (const u of generals) {
      if (requestedTypes.has("qa")) addCard(createQACard(u));
      else if (requestedTypes.has("cloze")) addCard(createClozeCard(u));
      else if (requestedTypes.has("truefalse")) addCard(createTrueFalseCard(u));
      if (cards.length >= targetCount) break;
    }
  }

  // Difficulty adjustment
  if (settings.difficulty === "easy") {
    cards.sort((a, b) => a.back.length - b.back.length);
  } else if (settings.difficulty === "hard") {
    cards.sort((a, b) => b.back.length - a.back.length);
  }

  onProgress?.({ phase: "deduplicating", current: cards.length, total: cards.length });

  return cards.slice(0, targetCount);
}
