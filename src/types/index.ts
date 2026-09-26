// ─── Folio Data Contracts ───────────────────────────────────────────
// Phase 1: Core types — every generation/edit path validates against these.

export type CardType = "qa" | "cloze" | "mcq" | "truefalse";

export interface Card {
  id: string;
  type: CardType;
  front: string;
  back: string;
  options?: string[];           // required + validated for mcq
  sourcePages: number[];        // non-empty; must fall inside selected range
  createdFrom: "ai" | "sample" | "manual";
  tags?: string[];
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

export interface AppearanceSettings {
  backgroundColor: string;      // hex
  accentColor: string;          // hex
  fontFamily: string;
  fontSize: number;             // px
  layout: "classic" | "compact" | "wide";
  preset: string;               // preset name or "custom"
}

export interface GenerationSettings {
  pageRange: [number, number] | null;  // null = all pages
  targetSize: "short" | "standard" | "detailed";
  cardTypes: CardType[];
  difficulty: "easy" | "medium" | "hard";
  answerLength: "brief" | "moderate" | "detailed";
  topicFocus?: string;
  topicExclusions?: string[];
  outputLanguage: string;
}

export interface StudyProgressEntry {
  known: boolean;
  lastReviewed: string;         // ISO 8601
  reviewCount: number;
}

export interface Deck {
  id: string;
  schemaVersion: number;        // bump on breaking shape change; write a migration
  title: string;
  subject?: string;
  cards: Card[];
  appearance: AppearanceSettings;
  generationSettings: GenerationSettings;
  studyProgress: Record<string, StudyProgressEntry>;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

export type ErrorKind =
  | "InvalidFileError"
  | "PasswordProtectedError"
  | "EmptyDocumentError"
  | "PageRangeError"
  | "ProviderUnavailableError"
  | "SchemaValidationError"
  | "ExportError";

export class FolioError extends Error {
  readonly kind: ErrorKind;
  readonly details?: unknown;

  constructor(kind: ErrorKind, message: string, details?: unknown) {
    super(message);
    this.name = "FolioError";
    this.kind = kind;
    this.details = details;
  }
}

// Current schema version
export const CURRENT_SCHEMA_VERSION = 1;
