// ─── Zod Schemas ────────────────────────────────────────────────────
// Runtime validation for Card/Deck — used at every AI response boundary,
// every import, and every edit mutation.

import { z } from "zod";

export const CardTypeSchema = z.enum(["qa", "cloze", "mcq", "truefalse"]);

export const CardSchema = z
  .object({
    id: z.string().min(1),
    type: CardTypeSchema,
    front: z.string().min(1, "Card front text is required"),
    back: z.string().min(1, "Card back text is required"),
    options: z.array(z.string().min(1)).optional(),
    sourcePages: z
      .array(z.number().int().positive())
      .min(1, "At least one source page is required"),
    createdFrom: z.enum(["ai", "sample", "manual"]),
    tags: z.array(z.string()).optional(),
    createdAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
    updatedAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  })
  .refine(
    (card) => {
      if (card.type === "mcq") {
        return (
          Array.isArray(card.options) &&
          card.options.length >= 2
        );
      }
      return true;
    },
    { message: "MCQ cards must have at least 2 options", path: ["options"] }
  );

export const AppearanceSettingsSchema = z.object({
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  fontFamily: z.string().min(1),
  fontSize: z.number().int().min(10).max(32),
  layout: z.enum(["classic", "compact", "wide"]),
  preset: z.string().min(1),
});

export const GenerationSettingsSchema = z.object({
  pageRange: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .nullable(),
  targetSize: z.enum(["short", "standard", "detailed"]),
  cardTypes: z.array(CardTypeSchema).min(1, "Select at least one card type"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  answerLength: z.enum(["brief", "moderate", "detailed"]),
  topicFocus: z.string().optional(),
  topicExclusions: z.array(z.string()).optional(),
  outputLanguage: z.string().min(1),
});

export const StudyProgressEntrySchema = z.object({
  known: z.boolean(),
  lastReviewed: z.string().min(1),
  reviewCount: z.number().int().min(0),
});

export const DeckSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  title: z.string().min(1, "Deck title is required"),
  subject: z.string().optional(),
  cards: z.array(CardSchema),
  appearance: AppearanceSettingsSchema,
  generationSettings: GenerationSettingsSchema,
  studyProgress: z.record(z.string(), StudyProgressEntrySchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// Schema for validating AI-generated cards (before we add id/timestamps)
export const AIGeneratedCardSchema = z
  .object({
    type: CardTypeSchema,
    front: z.string().min(1, "Card front text is required"),
    back: z.string().min(1, "Card back text is required"),
    options: z.array(z.string().min(1)).optional(),
    sourcePages: z
      .array(z.number().int().positive())
      .min(1, "At least one source page is required"),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (card) => {
      if (card.type === "mcq") {
        return Array.isArray(card.options) && card.options.length >= 2;
      }
      return true;
    },
    { message: "MCQ cards must have at least 2 options", path: ["options"] }
  );

export const AIResponseSchema = z.object({
  cards: z.array(AIGeneratedCardSchema).min(1, "At least one card is required"),
});

// Validate page range against actual page count
export function validatePageRange(
  range: [number, number] | null,
  totalPages: number
): { valid: boolean; error?: string } {
  if (range === null) return { valid: true };
  const [start, end] = range;
  if (start < 1) return { valid: false, error: "Start page must be at least 1" };
  if (end > totalPages)
    return {
      valid: false,
      error: `End page (${end}) exceeds total pages (${totalPages})`,
    };
  if (start > end)
    return { valid: false, error: "Start page must be ≤ end page" };
  return { valid: true };
}

// Validate card source pages against allowed range
export function validateSourcePages(
  sourcePages: number[],
  allowedRange: [number, number]
): boolean {
  return sourcePages.every(
    (p) => p >= allowedRange[0] && p <= allowedRange[1]
  );
}
