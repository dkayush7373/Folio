// ─── Deck Setup Controls ────────────────────────────────────────────
// Page range, detected topic focus, card types, difficulty, and optional AI enhancement.

import { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { CardType, GenerationSettings } from "../types";
import { FolioError } from "../types";
import { validatePageRange } from "../schemas";
import { getTextPages } from "../services/pdfProcessor";

interface DeckSetupProps {
  onGenerate: () => void;
}

export default function DeckSetup({ onGenerate }: DeckSetupProps) {
  const { state, dispatch } = useApp();
  const pdfData = state.pdfData;
  const deck = state.deck;

  const totalPages = pdfData?.pageCount ?? 0;
  const textPages = useMemo(
    () => (pdfData ? getTextPages(pdfData.pages) : []),
    [pdfData]
  );

  const [useAllPages, setUseAllPages] = useState(true);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(totalPages);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [pageContentWarning, setPageContentWarning] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [geminiKey, setGeminiKey] = useState(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem("folio_gemini_key") || "" : "")
  );

  const settings: GenerationSettings = deck?.generationSettings ?? {
    pageRange: null,
    targetSize: "standard",
    cardTypes: ["qa", "cloze", "mcq"],
    difficulty: "medium",
    answerLength: "moderate",
    outputLanguage: "English",
  };

  useEffect(() => {
    if (totalPages > 0) setEndPage(totalPages);
  }, [totalPages]);

  // Validate page range live
  useEffect(() => {
    if (useAllPages) {
      setRangeError(null);
      setPageContentWarning(null);
      return;
    }

    const result = validatePageRange([startPage, endPage], totalPages);
    if (!result.valid) {
      setRangeError(result.error!);
      setPageContentWarning(null);
      return;
    }

    setRangeError(null);

    // Check if selected range has text pages
    const textInRange = textPages.filter(
      (p) => p >= startPage && p <= endPage
    );
    if (textInRange.length === 0) {
      setPageContentWarning(
        "No readable text found in this page range. These pages may contain only images."
      );
    } else if (textInRange.length < endPage - startPage + 1) {
      const noText = [];
      for (let i = startPage; i <= endPage; i++) {
        if (!textPages.includes(i)) noText.push(i);
      }
      setPageContentWarning(
        `Pages ${noText.join(", ")} contain minimal text and will be skipped.`
      );
    } else {
      setPageContentWarning(null);
    }
  }, [useAllPages, startPage, endPage, totalPages, textPages]);

  const updateSetting = <K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K]
  ) => {
    const updated: GenerationSettings = {
      ...settings,
      [key]: value,
      pageRange: useAllPages ? null : [startPage, endPage],
    };
    dispatch({ type: "SET_GENERATION_SETTINGS", settings: updated });
  };

  const toggleCardType = (type: CardType) => {
    const current = settings.cardTypes;
    let updated: CardType[];
    if (current.includes(type)) {
      updated = current.filter((t) => t !== type);
    } else {
      updated = [...current, type];
    }
    if (updated.length === 0) return; // Must have at least one
    updateSetting("cardTypes", updated);
  };

  const handleSaveGeminiKey = (key: string) => {
    setGeminiKey(key);
    if (typeof localStorage !== "undefined") {
      if (key.trim()) {
        localStorage.setItem("folio_gemini_key", key.trim());
      } else {
        localStorage.removeItem("folio_gemini_key");
      }
    }
  };

  const handleGenerate = () => {
    if (!useAllPages) {
      const result = validatePageRange([startPage, endPage], totalPages);
      if (!result.valid) {
        throw new FolioError("PageRangeError", result.error!);
      }
      const textInRange = textPages.filter(
        (p) => p >= startPage && p <= endPage
      );
      if (textInRange.length === 0) {
        throw new FolioError(
          "PageRangeError",
          "No readable text in the selected page range."
        );
      }
    }

    const finalSettings: GenerationSettings = {
      ...settings,
      pageRange: useAllPages ? null : [startPage, endPage],
    };
    dispatch({ type: "SET_GENERATION_SETTINGS", settings: finalSettings });
    onGenerate();
  };

  const cardTypeOptions: { type: CardType; label: string; desc: string }[] = [
    { type: "qa", label: "Questions & Answers", desc: "Key concepts & definitions" },
    { type: "cloze", label: "Fill-in-the-Blank", desc: "Domain terminology & formulas" },
    { type: "mcq", label: "Multiple Choice", desc: "4 choices from document context" },
    { type: "truefalse", label: "True / False", desc: "Core facts with verification" },
  ];

  return (
    <section className="setup-section" aria-label="Deck Setup">
      <h2 className="setup-title">Configure Your Flashcard Deck</h2>

      {/* Detected Topics from Document */}
      {pdfData?.detectedTopics && pdfData.detectedTopics.length > 0 && (
        <fieldset className="setup-group">
          <legend className="setup-label">
            Key Topics Found in Document
            <span className="setup-optional"> (Click to focus flashcards on a specific topic)</span>
          </legend>
          <div className="setup-topic-pills">
            {pdfData.detectedTopics.map((topic, idx) => {
              const isSelected = settings.topicFocus === topic.title;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`chip ${isSelected ? "chip--active" : ""}`}
                  onClick={() =>
                    updateSetting("topicFocus", isSelected ? undefined : topic.title)
                  }
                  title={`Found on page ${topic.pageNumber}${topic.snippet ? `\n"${topic.snippet}"` : ""}`}
                >
                  <span className="topic-chip-page">p.{topic.pageNumber}</span>
                  {topic.title}
                </button>
              );
            })}
          </div>
          {settings.topicFocus && (
            <div className="setup-active-focus-bar">
              <span>Focusing on: <strong>{settings.topicFocus}</strong></span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => updateSetting("topicFocus", undefined)}
              >
                Clear filter (use entire PDF)
              </button>
            </div>
          )}
        </fieldset>
      )}

      {/* Page Range */}
      <fieldset className="setup-group">
        <legend className="setup-label">Page Selection</legend>
        <label className="setup-toggle" htmlFor="use-all-pages">
          <input
            type="checkbox"
            id="use-all-pages"
            checked={useAllPages}
            onChange={(e) => setUseAllPages(e.target.checked)}
          />
          <span>Include all pages (1–{totalPages})</span>
        </label>

        {!useAllPages && (
          <div className="setup-range-inputs">
            <label htmlFor="start-page" className="sr-only">Start page</label>
            <input
              type="number"
              id="start-page"
              min={1}
              max={totalPages}
              value={startPage}
              onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
              className="setup-input setup-input--small"
              aria-label="Start page"
            />
            <span className="setup-range-sep">to</span>
            <label htmlFor="end-page" className="sr-only">End page</label>
            <input
              type="number"
              id="end-page"
              min={1}
              max={totalPages}
              value={endPage}
              onChange={(e) => setEndPage(parseInt(e.target.value) || totalPages)}
              className="setup-input setup-input--small"
              aria-label="End page"
            />
            <span className="setup-range-total">of {totalPages} pages</span>
          </div>
        )}

        {rangeError && (
          <p className="setup-error" role="alert" id="page-range-error">
            {rangeError}
          </p>
        )}
        {pageContentWarning && !rangeError && (
          <p className="setup-warning" role="status" id="page-content-warning">
            {pageContentWarning}
          </p>
        )}
      </fieldset>

      {/* Deck Size */}
      <fieldset className="setup-group">
        <legend className="setup-label">Deck Size</legend>
        <div className="setup-chips">
          {(["short", "standard", "detailed"] as const).map((size) => (
            <button
              key={size}
              type="button"
              className={`chip ${settings.targetSize === size ? "chip--active" : ""}`}
              onClick={() => updateSetting("targetSize", size)}
              id={`size-${size}`}
            >
              {size === "short"
                ? "Compact (~6 cards)"
                : size === "standard"
                  ? "Standard (~14 cards)"
                  : "Comprehensive (~24 cards)"}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Card Types */}
      <fieldset className="setup-group">
        <legend className="setup-label">Flashcard Styles</legend>
        <div className="setup-card-types">
          {cardTypeOptions.map(({ type, label, desc }) => (
            <label
              key={type}
              className={`setup-card-type ${settings.cardTypes.includes(type) ? "setup-card-type--active" : ""}`}
              htmlFor={`card-type-${type}`}
            >
              <input
                type="checkbox"
                id={`card-type-${type}`}
                checked={settings.cardTypes.includes(type)}
                onChange={() => toggleCardType(type)}
              />
              <span className="setup-card-type-label">{label}</span>
              <span className="setup-card-type-desc">{desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Difficulty & Length */}
      <div className="setup-row">
        <fieldset className="setup-group">
          <legend className="setup-label">Depth / Difficulty</legend>
          <div className="setup-chips">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${settings.difficulty === d ? "chip--active" : ""}`}
                onClick={() => updateSetting("difficulty", d)}
                id={`difficulty-${d}`}
              >
                {d === "easy" ? "Introductory" : d === "medium" ? "Standard" : "Advanced"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="setup-group">
          <legend className="setup-label">Answer Length</legend>
          <div className="setup-chips">
            {(["brief", "moderate", "detailed"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`chip ${settings.answerLength === l ? "chip--active" : ""}`}
                onClick={() => updateSetting("answerLength", l)}
                id={`answer-${l}`}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Advanced / Optional AI Settings Toggle */}
      <div className="setup-advanced-section">
        <button
          type="button"
          className="btn btn--ghost btn--sm setup-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "▾ Hide Advanced Settings" : "▸ Advanced Settings & AI Provider (Optional)"}
        </button>

        {showAdvanced && (
          <div className="setup-advanced-panel">
            <div className="setup-group">
              <label className="setup-label" htmlFor="gemini-key">
                Google Gemini API Key <span className="setup-optional">(Optional, saves to your browser)</span>
              </label>
              <input
                type="password"
                id="gemini-key"
                className="setup-input"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => handleSaveGeminiKey(e.target.value)}
              />
              <p className="setup-hint">
                By default, Folio uses its smart on-device document intelligence engine (no key required, 100% private).
                You can optionally add a free Gemini Flash API key for LLM-enhanced generation.
              </p>
            </div>

            <div className="setup-group">
              <label className="setup-label" htmlFor="topic-exclusions">
                Exclude Topics / Terms <span className="setup-optional">(Optional)</span>
              </label>
              <input
                type="text"
                id="topic-exclusions"
                className="setup-input"
                placeholder="e.g. bibliography, copyright, index"
                value={settings.topicExclusions?.join(", ") || ""}
                onChange={(e) =>
                  updateSetting(
                    "topicExclusions",
                    e.target.value
                      ? e.target.value.split(",").map((s) => s.trim())
                      : undefined
                  )
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        className="btn btn--primary btn--lg"
        onClick={handleGenerate}
        disabled={state.generating || !state.pdfData || !!rangeError}
        id="generate-btn"
      >
        {state.generating ? (
          <>
            <span className="btn-spinner" /> Reading PDF & Generating Cards...
          </>
        ) : (
          `Generate Flashcards from "${pdfData?.detectedTitle || pdfData?.fileName || "PDF"}"`
        )}
      </button>
    </section>
  );
}
