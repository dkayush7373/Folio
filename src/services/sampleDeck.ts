// ─── Sample Deck ────────────────────────────────────────────────────
// Loaded when no AI provider is configured. Clearly labeled as sample.

import { v4 as uuidv4 } from "uuid";
import type { Card, Deck } from "../types";
import { CURRENT_SCHEMA_VERSION } from "../types";
import { defaultAppearance } from "../utils/appearance";

const now = new Date().toISOString();

function makeCard(
  type: Card["type"],
  front: string,
  back: string,
  page: number,
  options?: string[]
): Card {
  return {
    id: uuidv4(),
    type,
    front,
    back,
    options,
    sourcePages: [page],
    createdFrom: "sample",
    tags: ["sample"],
    createdAt: now,
    updatedAt: now,
  };
}

export function createSampleDeck(): Deck {
  const cards: Card[] = [
    makeCard(
      "qa",
      "What is photosynthesis?",
      "Photosynthesis is the process by which green plants convert sunlight, water, and carbon dioxide into glucose and oxygen using chlorophyll.",
      1
    ),
    makeCard(
      "cloze",
      "The mitochondria is often called the ___ of the cell.",
      "The mitochondria is often called the powerhouse of the cell.",
      1
    ),
    makeCard(
      "mcq",
      "Which organelle is responsible for protein synthesis?",
      "Ribosome",
      2,
      ["Ribosome", "Golgi apparatus", "Lysosome", "Nucleus"]
    ),
    makeCard(
      "truefalse",
      "DNA is a single-stranded molecule.",
      "False — DNA is a double-stranded helix consisting of two complementary strands.",
      2
    ),
    makeCard(
      "qa",
      "What is the difference between mitosis and meiosis?",
      "Mitosis produces two identical diploid cells for growth and repair, while meiosis produces four genetically unique haploid cells for reproduction.",
      3
    ),
    makeCard(
      "cloze",
      "The chemical formula for water is ___.",
      "The chemical formula for water is H₂O.",
      3
    ),
    makeCard(
      "mcq",
      "What type of bond involves the sharing of electrons?",
      "Covalent bond",
      4,
      ["Ionic bond", "Covalent bond", "Hydrogen bond", "Metallic bond"]
    ),
    makeCard(
      "truefalse",
      "The speed of light in a vacuum is approximately 3 × 10⁸ m/s.",
      "True — The speed of light in a vacuum is approximately 299,792,458 m/s, commonly rounded to 3 × 10⁸ m/s.",
      4
    ),
    makeCard(
      "qa",
      "What is Newton's Second Law of Motion?",
      "Force equals mass times acceleration (F = ma). The acceleration of an object depends on the net force acting on it and its mass.",
      5
    ),
    makeCard(
      "cloze",
      "In the periodic table, elements are arranged by increasing ___.",
      "In the periodic table, elements are arranged by increasing atomic number.",
      5
    ),
  ];

  return {
    id: uuidv4(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: "📋 Sample Deck — General Science",
    subject: "Science",
    cards,
    appearance: defaultAppearance(),
    generationSettings: {
      pageRange: null,
      targetSize: "standard",
      cardTypes: ["qa", "cloze", "mcq", "truefalse"],
      difficulty: "medium",
      answerLength: "moderate",
      outputLanguage: "English",
    },
    studyProgress: {},
    createdAt: now,
    updatedAt: now,
  };
}
