// ─── Setup View ─────────────────────────────────────────────────────
// Upload PDF → Configure → Generate cards directly from text content.

import { useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import PDFUpload from "./PDFUpload";
import DeckSetup from "./DeckSetup";
import {
  generateCardsFromText,
  type LocalGenerationProgress,
} from "../services/textCardGenerator";
import { FolioError } from "../types";

export default function SetupView() {
  const { state, dispatch } = useApp();
  const [genProgress, setGenProgress] = useState<LocalGenerationProgress | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    if (!state.pdfData || !state.deck) return;

    dispatch({ type: "SET_GENERATING", generating: true });
    setGenError(null);
    setGenProgress(null);

    // Use setTimeout to allow UI to update before processing
    setTimeout(() => {
      try {
        const cards = generateCardsFromText(
          state.pdfData!.pages,
          state.deck!.generationSettings,
          (progress) => setGenProgress(progress)
        );

        if (cards.length === 0) {
          throw new FolioError(
            "EmptyDocumentError",
            "Could not extract flashcards from this PDF. Please verify that the PDF contains selectable text rather than scanned images."
          );
        }

        // Update deck title from PDF detected title or filename
        const pdfName =
          state.pdfData!.detectedTitle ||
          state.pdfData!.fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
        const primaryTopic = state.pdfData!.detectedTopics?.[0]?.title;

        const existingCards = state.deck!.cards;
        dispatch({ type: "UPDATE_CARDS", cards: [...existingCards, ...cards] });
        if (state.deck!.title === "New Deck" || state.deck!.title === "") {
          dispatch({
            type: "SET_DECK_META",
            title: pdfName,
            subject: primaryTopic || state.deck!.subject || "",
          });
        }
        dispatch({ type: "SET_VIEW", view: "editor" });
      } catch (err) {
        const message =
          err instanceof FolioError
            ? err.message
            : "An unexpected error occurred during generation.";
        setGenError(message);
        dispatch({ type: "SET_GENERATION_ERROR", error: message });
      } finally {
        dispatch({ type: "SET_GENERATING", generating: false });
        setGenProgress(null);
      }
    }, 50);
  }, [state.pdfData, state.deck, dispatch]);

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "analyzing": return "Reading & analyzing document sections";
      case "generating": return "Creating source-linked flashcards";
      case "deduplicating": return "Polishing questions and answers";
      default: return "Processing document";
    }
  };

  return (
    <div className="setup-view">
      <div className="setup-view-header">
        <button
          className="btn btn--ghost"
          onClick={() => dispatch({ type: "SET_VIEW", view: "home" })}
          id="back-to-home"
        >
          ← Home
        </button>
        <h1 className="setup-view-title">New Study Deck</h1>
      </div>

      <div className="setup-view-content">
        {/* Step 1: Upload */}
        <div className="setup-step">
          <div className="setup-step-number">1</div>
          <h2 className="setup-step-title">Upload Document</h2>
          <p className="setup-step-desc">
            Folio reads the pages, extracts key topics, and builds flashcards from your text.
          </p>
          <PDFUpload />
        </div>

        {/* Step 2: Configure */}
        {state.pdfData && (
          <div className="setup-step">
            <div className="setup-step-number">2</div>
            <h2 className="setup-step-title">Review Topics & Deck Settings</h2>
            <p className="setup-step-desc">
              Select key topics to focus on, choose question formats, and customize your study deck.
            </p>
            <DeckSetup onGenerate={handleGenerate} />
          </div>
        )}

        {/* Generation progress */}
        {state.generating && genProgress && (
          <div className="setup-step">
            <div className="setup-step-number">⚡</div>
            <div className="gen-local-progress" role="status" aria-live="polite">
              <div className="gen-local-label">
                {phaseLabel(genProgress.phase)}...
              </div>
              <div className="gen-progress-bar">
                <div
                  className="gen-progress-fill"
                  style={{
                    width: `${genProgress.total > 0 ? (genProgress.current / genProgress.total) * 100 : 0}%`,
                  }}
                  role="progressbar"
                  aria-valuenow={genProgress.current}
                  aria-valuemin={0}
                  aria-valuemax={genProgress.total}
                />
              </div>
              <div className="gen-local-detail">
                {genProgress.current} / {genProgress.total}
              </div>
            </div>
          </div>
        )}

        {/* Generation error */}
        {genError && (
          <div className="setup-error" role="alert">
            <strong>Notice:</strong> {genError}
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleGenerate}
              style={{ marginLeft: 12 }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
