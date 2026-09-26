// ─── App Context ────────────────────────────────────────────────────
// Central state management using React Context + useReducer.

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  Deck,
  Card,
  AppearanceSettings,
  GenerationSettings,
} from "../types";
import { CURRENT_SCHEMA_VERSION } from "../types";
import { saveDeck, loadDeck, listDecks } from "../db";
import { migrateDeck } from "../schemas/migration";
import { defaultAppearance } from "../utils/appearance";
import type { PDFExtractionResult } from "../services/pdfProcessor";

// ─── State ──────────────────────────────────────────────────────────

export interface AppState {
  // PDF
  pdfData: PDFExtractionResult | null;
  pdfLoading: boolean;
  pdfError: string | null;

  // Deck
  deck: Deck | null;
  deckList: Deck[];
  saveStatus: "saved" | "saving" | "unsaved" | "error";
  undoStack: Deck[];

  // Generation
  generating: boolean;
  generationError: string | null;

  // Study
  studyMode: boolean;
  studyIndex: number;
  studyShuffled: boolean;
  studyOrder: number[];
  studyRevealed: boolean;

  // UI
  currentView: "home" | "setup" | "editor" | "study" | "appearance";
}

const initialState: AppState = {
  pdfData: null,
  pdfLoading: false,
  pdfError: null,
  deck: null,
  deckList: [],
  saveStatus: "saved",
  undoStack: [],
  generating: false,
  generationError: null,
  studyMode: false,
  studyIndex: 0,
  studyShuffled: false,
  studyOrder: [],
  studyRevealed: false,
  currentView: "home",
};

// ─── Actions ────────────────────────────────────────────────────────

type Action =
  | { type: "SET_PDF_LOADING"; loading: boolean }
  | { type: "SET_PDF_DATA"; data: PDFExtractionResult }
  | { type: "SET_PDF_ERROR"; error: string | null }
  | { type: "CLEAR_PDF" }
  | { type: "SET_DECK"; deck: Deck }
  | { type: "SET_DECK_LIST"; decks: Deck[] }
  | { type: "UPDATE_CARDS"; cards: Card[] }
  | { type: "ADD_CARD"; card: Card }
  | { type: "DELETE_CARD"; cardId: string }
  | { type: "UPDATE_CARD"; card: Card }
  | { type: "REORDER_CARDS"; fromIndex: number; toIndex: number }
  | { type: "SET_APPEARANCE"; appearance: AppearanceSettings }
  | { type: "SET_GENERATION_SETTINGS"; settings: GenerationSettings }
  | { type: "SET_DECK_META"; title: string; subject?: string }
  | { type: "SET_SAVE_STATUS"; status: AppState["saveStatus"] }
  | { type: "PUSH_UNDO" }
  | { type: "POP_UNDO" }
  | { type: "SET_GENERATING"; generating: boolean }
  | { type: "SET_GENERATION_ERROR"; error: string | null }
  | { type: "SET_VIEW"; view: AppState["currentView"] }
  | { type: "START_STUDY"; shuffle: boolean }
  | { type: "STUDY_NEXT" }
  | { type: "STUDY_PREV" }
  | { type: "STUDY_REVEAL" }
  | { type: "STUDY_MARK"; cardId: string; known: boolean }
  | { type: "EXIT_STUDY" }
  | {
      type: "SET_STUDY_PROGRESS";
      cardId: string;
      known: boolean;
    };

function shuffleArray(arr: number[]): number[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PDF_LOADING":
      return { ...state, pdfLoading: action.loading, pdfError: null };
    case "SET_PDF_DATA":
      return { ...state, pdfData: action.data, pdfLoading: false, pdfError: null };
    case "SET_PDF_ERROR":
      return { ...state, pdfError: action.error, pdfLoading: false };
    case "CLEAR_PDF":
      return { ...state, pdfData: null, pdfError: null };

    case "SET_DECK":
      return {
        ...state,
        deck: action.deck,
        saveStatus: "saved",
        currentView: action.deck.cards.length > 0 ? "editor" : state.currentView,
      };
    case "SET_DECK_LIST":
      return { ...state, deckList: action.decks };

    case "UPDATE_CARDS": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        cards: action.cards,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "ADD_CARD": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        cards: [...state.deck.cards, action.card],
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "DELETE_CARD": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        cards: state.deck.cards.filter((c) => c.id !== action.cardId),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "UPDATE_CARD": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        cards: state.deck.cards.map((c) =>
          c.id === action.card.id ? action.card : c
        ),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "REORDER_CARDS": {
      if (!state.deck) return state;
      const cards = [...state.deck.cards];
      const [moved] = cards.splice(action.fromIndex, 1);
      cards.splice(action.toIndex, 0, moved);
      const updated = {
        ...state.deck,
        cards,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "SET_APPEARANCE": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        appearance: action.appearance,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "SET_GENERATION_SETTINGS": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        generationSettings: action.settings,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "SET_DECK_META": {
      if (!state.deck) return state;
      const updated = {
        ...state.deck,
        title: action.title,
        subject: action.subject,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, deck: updated, saveStatus: "unsaved" };
    }

    case "SET_SAVE_STATUS":
      return { ...state, saveStatus: action.status };

    case "PUSH_UNDO": {
      if (!state.deck) return state;
      return {
        ...state,
        undoStack: [...state.undoStack.slice(-19), { ...state.deck }],
      };
    }

    case "POP_UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        deck: prev,
        undoStack: state.undoStack.slice(0, -1),
        saveStatus: "unsaved",
      };
    }

    case "SET_GENERATING":
      return { ...state, generating: action.generating };
    case "SET_GENERATION_ERROR":
      return { ...state, generationError: action.error };
    case "SET_VIEW":
      return { ...state, currentView: action.view };

    case "START_STUDY": {
      if (!state.deck) return state;
      const count = state.deck.cards.length;
      const order = Array.from({ length: count }, (_, i) => i);
      return {
        ...state,
        studyMode: true,
        studyIndex: 0,
        studyShuffled: action.shuffle,
        studyOrder: action.shuffle ? shuffleArray(order) : order,
        studyRevealed: false,
        currentView: "study",
      };
    }

    case "STUDY_NEXT": {
      const maxIdx = state.studyOrder.length - 1;
      if (state.studyIndex >= maxIdx) return state;
      return { ...state, studyIndex: state.studyIndex + 1, studyRevealed: false };
    }

    case "STUDY_PREV": {
      if (state.studyIndex <= 0) return state;
      return { ...state, studyIndex: state.studyIndex - 1, studyRevealed: false };
    }

    case "STUDY_REVEAL":
      return { ...state, studyRevealed: true };

    case "STUDY_MARK": {
      if (!state.deck) return state;
      const progress = { ...state.deck.studyProgress };
      progress[action.cardId] = {
        known: action.known,
        lastReviewed: new Date().toISOString(),
        reviewCount: (progress[action.cardId]?.reviewCount || 0) + 1,
      };
      const updated = {
        ...state.deck,
        studyProgress: progress,
        updatedAt: new Date().toISOString(),
      };

      // If "review again" — re-queue card near end
      let newOrder = state.studyOrder;
      if (!action.known) {
        const currentOrderIdx = state.studyOrder[state.studyIndex];
        newOrder = [...state.studyOrder, currentOrderIdx];
      }

      // Auto-advance
      const maxIdx = newOrder.length - 1;
      const nextIndex = Math.min(state.studyIndex + 1, maxIdx);

      return {
        ...state,
        deck: updated,
        saveStatus: "unsaved",
        studyOrder: newOrder,
        studyIndex: nextIndex,
        studyRevealed: false,
      };
    }

    case "EXIT_STUDY":
      return { ...state, studyMode: false, currentView: "editor" };

    case "SET_STUDY_PROGRESS": {
      if (!state.deck) return state;
      const progress = { ...state.deck.studyProgress };
      progress[action.cardId] = {
        known: action.known,
        lastReviewed: new Date().toISOString(),
        reviewCount: (progress[action.cardId]?.reviewCount || 0) + 1,
      };
      return {
        ...state,
        deck: {
          ...state.deck,
          studyProgress: progress,
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
      };
    }

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  createNewDeck: (title: string, subject?: string) => Deck;
  save: () => Promise<void>;
  undo: () => void;
  loadExistingDeck: (id: string) => Promise<void>;
  refreshDeckList: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Auto-save debounce
  useEffect(() => {
    if (state.saveStatus !== "unsaved" || !state.deck) return;
    const timer = setTimeout(async () => {
      dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
      try {
        await saveDeck(state.deck!);
        dispatch({ type: "SET_SAVE_STATUS", status: "saved" });
      } catch {
        dispatch({ type: "SET_SAVE_STATUS", status: "error" });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [state.saveStatus, state.deck]);

  // Load deck list on mount
  useEffect(() => {
    listDecks().then((decks) => {
      const migrated = decks.map((d) => migrateDeck(d));
      dispatch({ type: "SET_DECK_LIST", decks: migrated });
    });
  }, []);

  const createNewDeck = useCallback(
    (title: string, subject?: string): Deck => {
      const deck: Deck = {
        id: uuidv4(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        title,
        subject,
        cards: [],
        appearance: defaultAppearance(),
        generationSettings: {
          pageRange: null,
          targetSize: "standard",
          cardTypes: ["qa", "cloze", "mcq"],
          difficulty: "medium",
          answerLength: "moderate",
          outputLanguage: "English",
        },
        studyProgress: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: "SET_DECK", deck });
      return deck;
    },
    []
  );

  const save = useCallback(async () => {
    if (!state.deck) return;
    dispatch({ type: "SET_SAVE_STATUS", status: "saving" });
    try {
      await saveDeck(state.deck);
      dispatch({ type: "SET_SAVE_STATUS", status: "saved" });
      const decks = await listDecks();
      dispatch({ type: "SET_DECK_LIST", decks });
    } catch {
      dispatch({ type: "SET_SAVE_STATUS", status: "error" });
    }
  }, [state.deck]);

  const undo = useCallback(() => {
    dispatch({ type: "POP_UNDO" });
  }, []);

  const loadExistingDeck = useCallback(async (id: string) => {
    const raw = await loadDeck(id);
    if (raw) {
      const deck = migrateDeck(raw);
      dispatch({ type: "SET_DECK", deck });
    }
  }, []);

  const refreshDeckList = useCallback(async () => {
    const decks = await listDecks();
    dispatch({ type: "SET_DECK_LIST", decks });
  }, []);

  return (
    <AppContext.Provider
      value={{ state, dispatch, createNewDeck, save, undo, loadExistingDeck, refreshDeckList }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
