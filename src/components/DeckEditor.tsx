// ─── Deck Editor ────────────────────────────────────────────────────
// Full CRUD: edit, add, delete, duplicate, reorder, search, filter,
// rename deck, visible undo, exit/back navigation to upload and home.

import { useState, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useApp } from "../context/AppContext";
import type { Card, CardType } from "../types";
import { generateCSV, downloadCSV } from "../services/csvExport";
import { FolioError } from "../types";

export default function DeckEditor() {
  const { state, dispatch, undo } = useApp();
  const deck = state.deck;

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<CardType | "all">("all");
  const [filterPage, setFilterPage] = useState<number | null>(null);

  // Edit card state
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // New card state
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState<Partial<Card>>({
    type: "qa",
    front: "",
    back: "",
    sourcePages: [1],
    options: ["", "", "", ""],
  });
  const [newCardError, setNewCardError] = useState<string | null>(null);
  const [mcqCorrectIndex, setMcqCorrectIndex] = useState<number>(0);

  const [exportError, setExportError] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    if (!deck) return [];
    let cards = deck.cards;

    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.front.toLowerCase().includes(q) ||
          c.back.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filterType !== "all") {
      cards = cards.filter((c) => c.type === filterType);
    }

    if (filterPage !== null) {
      cards = cards.filter((c) => c.sourcePages.includes(filterPage));
    }

    return cards;
  }, [deck, search, filterType, filterPage]);

  // Navigation handlers
  const handleBackToHome = () => {
    dispatch({ type: "SET_VIEW", view: "home" });
  };

  const handleBackToUpload = () => {
    dispatch({ type: "CLEAR_PDF" });
    dispatch({ type: "SET_VIEW", view: "setup" });
  };

  const startEdit = useCallback((card: Card) => {
    setEditingCard(card.id);
    setEditForm({ ...card, options: card.options ? [...card.options] : ["", "", "", ""] });
    setEditFormError(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editForm.id) return;
    setEditFormError(null);

    const front = editForm.front?.trim() || "";
    if (!front) {
      setEditFormError("Card question or prompt (front) is required.");
      return;
    }

    let back = editForm.back?.trim() || "";
    let options: string[] | undefined = undefined;

    if (editForm.type === "mcq") {
      options = (editForm.options || []).map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        setEditFormError("Multiple-choice cards require at least 2 non-empty options.");
        return;
      }
      if (!back || !options.includes(back)) {
        back = options[0];
      }
    } else {
      if (!back) {
        setEditFormError("Card answer (back) is required.");
        return;
      }
    }

    dispatch({ type: "PUSH_UNDO" });
    dispatch({
      type: "UPDATE_CARD",
      card: {
        ...(editForm as Card),
        front,
        back,
        options,
        sourcePages: editForm.sourcePages && editForm.sourcePages.length > 0 ? editForm.sourcePages : [1],
        updatedAt: new Date().toISOString(),
      },
    });
    setEditingCard(null);
    setEditForm({});
    setEditFormError(null);
  }, [editForm, dispatch]);

  const cancelEdit = useCallback(() => {
    setEditingCard(null);
    setEditForm({});
    setEditFormError(null);
  }, []);

  const deleteCard = useCallback(
    (cardId: string) => {
      dispatch({ type: "PUSH_UNDO" });
      dispatch({ type: "DELETE_CARD", cardId });
    },
    [dispatch]
  );

  const duplicateCard = useCallback(
    (card: Card) => {
      dispatch({ type: "PUSH_UNDO" });
      const duplicate: Card = {
        ...card,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdFrom: "manual",
      };
      dispatch({ type: "ADD_CARD", card: duplicate });
    },
    [dispatch]
  );

  const moveCard = useCallback(
    (fromIndex: number, direction: "up" | "down") => {
      if (!deck) return;
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= deck.cards.length) return;
      dispatch({ type: "PUSH_UNDO" });
      dispatch({ type: "REORDER_CARDS", fromIndex, toIndex });
    },
    [deck, dispatch]
  );

  const addNewCard = useCallback(() => {
    setNewCardError(null);

    const front = newCard.front?.trim() || "";
    if (!front) {
      setNewCardError("Please enter the question or prompt on the front.");
      return;
    }

    let back = newCard.back?.trim() || "";
    let options: string[] | undefined = undefined;

    if (newCard.type === "mcq") {
      const filteredOptions = (newCard.options || []).map((o) => o.trim()).filter(Boolean);
      if (filteredOptions.length < 2) {
        setNewCardError("Multiple-choice cards require at least 2 options.");
        return;
      }
      options = filteredOptions;
      // If the selected index is valid, use that option as the answer
      const picked = options[mcqCorrectIndex];
      back = picked || options[0];
    } else if (newCard.type === "truefalse") {
      if (!back) back = "True";
    } else {
      if (!back) {
        setNewCardError("Please enter the answer on the back.");
        return;
      }
    }

    dispatch({ type: "PUSH_UNDO" });
    const card: Card = {
      id: uuidv4(),
      type: (newCard.type || "qa") as CardType,
      front,
      back,
      options,
      sourcePages: newCard.sourcePages && newCard.sourcePages.length > 0 ? newCard.sourcePages : [1],
      createdFrom: "manual",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_CARD", card });
    // Reset form
    setNewCard({
      type: "qa",
      front: "",
      back: "",
      sourcePages: [1],
      options: ["", "", "", ""],
    });
    setMcqCorrectIndex(0);
    setNewCardError(null);
    setShowAddCard(false);
  }, [newCard, mcqCorrectIndex, dispatch]);

  const handleExport = useCallback(() => {
    if (!deck) return;
    setExportError(null);
    try {
      const csv = generateCSV(deck.cards, deck.title);
      downloadCSV(csv, `${deck.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    } catch (err) {
      if (err instanceof FolioError) {
        setExportError(err.message);
      } else {
        setExportError("Failed to export. Please try again.");
      }
    }
  }, [deck]);

  if (!deck) return null;

  const cardTypeLabel = (type: CardType) => {
    const labels: Record<CardType, string> = {
      qa: "Q&A",
      cloze: "Cloze",
      mcq: "MCQ",
      truefalse: "T/F",
    };
    return labels[type];
  };

  const saveStatusDisplay = () => {
    switch (state.saveStatus) {
      case "saved":
        return { text: "Saved", icon: "✓", cls: "save-status--saved" };
      case "saving":
        return { text: "Saving...", icon: "↻", cls: "save-status--saving" };
      case "unsaved":
        return { text: "Unsaved", icon: "●", cls: "save-status--unsaved" };
      case "error":
        return { text: "Save failed", icon: "!", cls: "save-status--error" };
    }
  };

  const ss = saveStatusDisplay();

  const getRealIndex = (cardId: string) =>
    deck.cards.findIndex((c) => c.id === cardId);

  return (
    <section className="editor-section" aria-label="Deck Editor">
      {/* Top Navigation Bar: Back to 1st page, Home, Undo, Save Status */}
      <nav className="editor-nav-bar" aria-label="Editor navigation">
        <div className="editor-nav-left">
          <button
            className="btn btn--secondary btn--sm"
            onClick={handleBackToUpload}
            id="back-to-upload-btn"
            title="Return to the 1st page to upload a new PDF file"
          >
            ← Upload File
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleBackToHome}
            id="back-to-home-btn"
            title="Return to Home overview"
          >
            Home
          </button>
        </div>

        <div className="editor-nav-right">
          <button
            className="btn btn--secondary btn--sm"
            onClick={undo}
            disabled={state.undoStack.length === 0}
            title={
              state.undoStack.length > 0
                ? `Undo last edit (${state.undoStack.length} available) [Ctrl+Z]`
                : "No actions to undo"
            }
            id="undo-btn"
          >
            ↶ Undo {state.undoStack.length > 0 && `(${state.undoStack.length})`}
          </button>

          <span
            className={`save-status ${ss.cls}`}
            role="status"
            aria-live="polite"
            id="save-status"
          >
            <span className="save-status-icon">{ss.icon}</span>
            {ss.text}
          </span>
        </div>
      </nav>

      {/* Deck Metadata Header */}
      <div className="editor-header">
        <div className="editor-header-left">
          <input
            type="text"
            className="editor-title-input"
            value={deck.title}
            onChange={(e) =>
              dispatch({
                type: "SET_DECK_META",
                title: e.target.value,
                subject: deck.subject,
              })
            }
            aria-label="Deck title"
            id="deck-title-input"
            placeholder="Deck Title"
          />
          <input
            type="text"
            className="editor-subject-input"
            value={deck.subject || ""}
            placeholder="Subject or Topic (e.g. Science, Biology, History)"
            onChange={(e) =>
              dispatch({
                type: "SET_DECK_META",
                title: deck.title,
                subject: e.target.value || undefined,
              })
            }
            aria-label="Deck subject"
            id="deck-subject-input"
          />
        </div>

        <div className="editor-header-right">
          <button
            className="btn btn--primary"
            onClick={() => dispatch({ type: "START_STUDY", shuffle: false })}
            disabled={deck.cards.length === 0}
            id="study-btn"
          >
            📖 Study Deck ({deck.cards.length})
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-search">
          <svg className="editor-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="editor-search-input"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cards"
            id="search-cards"
          />
        </div>

        <select
          className="editor-filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CardType | "all")}
          aria-label="Filter by card type"
          id="filter-type"
        >
          <option value="all">All formats</option>
          <option value="qa">Q&A</option>
          <option value="cloze">Fill-in-the-blank</option>
          <option value="mcq">Multiple Choice</option>
          <option value="truefalse">True/False</option>
        </select>

        <input
          type="number"
          className="editor-filter-page"
          placeholder="Page #"
          value={filterPage ?? ""}
          onChange={(e) =>
            setFilterPage(e.target.value ? parseInt(e.target.value) : null)
          }
          min={1}
          aria-label="Filter by page number"
          id="filter-page"
        />

        <div className="editor-toolbar-actions">
          <button
            className="btn btn--secondary"
            onClick={() => {
              setShowAddCard(!showAddCard);
              setNewCardError(null);
            }}
            id="add-card-btn"
          >
            {showAddCard ? "✕ Close Form" : "+ Add Card"}
          </button>
          <button
            className="btn btn--secondary"
            onClick={handleExport}
            id="export-csv-btn"
            title="Download Anki/Quizlet compatible CSV"
          >
            📥 Export CSV
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => dispatch({ type: "SET_VIEW", view: "appearance" })}
            id="appearance-btn"
            title="Customize theme & typography"
          >
            🎨 Theme
          </button>
        </div>
      </div>

      {exportError && (
        <div className="editor-export-error" role="alert">
          {exportError}
          <button className="btn btn--secondary btn--sm" onClick={handleExport}>
            Retry Export
          </button>
        </div>
      )}

      {/* ─── Add Card Form (Fixed & Interactive) ──────────────────────── */}
      {showAddCard && (
        <div className="card-form" id="add-card-form">
          <div className="card-form-header">
            <h3 className="card-form-title">Add New Flashcard</h3>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setShowAddCard(false);
                setNewCardError(null);
              }}
              aria-label="Close form"
            >
              ✕
            </button>
          </div>

          {newCardError && (
            <div className="card-form-error" role="alert">
              <span>⚠️</span> {newCardError}
            </div>
          )}

          <div className="card-form-row">
            <label htmlFor="new-card-type">Card Format</label>
            <select
              id="new-card-type"
              className="setup-input"
              value={newCard.type}
              onChange={(e) => {
                const nextType = e.target.value as CardType;
                setNewCard({
                  ...newCard,
                  type: nextType,
                  back: nextType === "truefalse" ? "True" : newCard.back,
                  options: nextType === "mcq" ? (newCard.options?.length ? newCard.options : ["", "", "", ""]) : undefined,
                });
                setNewCardError(null);
              }}
            >
              <option value="qa">Questions & Answers (Q&A)</option>
              <option value="cloze">Fill in the blank (Cloze)</option>
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="truefalse">True / False</option>
            </select>
          </div>

          <div className="card-form-row">
            <label htmlFor="new-card-front">
              {newCard.type === "qa" && "Question (Front)"}
              {newCard.type === "cloze" && "Sentence with blank (use _______ for blank)"}
              {newCard.type === "mcq" && "Question / Prompt"}
              {newCard.type === "truefalse" && "Statement to Verify"}
            </label>
            <textarea
              id="new-card-front"
              className="card-form-textarea"
              value={newCard.front || ""}
              onChange={(e) => {
                setNewCard({ ...newCard, front: e.target.value });
                if (newCardError) setNewCardError(null);
              }}
              rows={3}
              placeholder={
                newCard.type === "cloze"
                  ? "e.g. Mitochondria is the _______ of the cell."
                  : newCard.type === "mcq"
                  ? "e.g. Which organelle produces cellular energy?"
                  : newCard.type === "truefalse"
                  ? "e.g. Light travels faster than sound."
                  : "Enter the question or concept prompt..."
              }
            />
          </div>

          {/* MCQ Option Controls */}
          {newCard.type === "mcq" && (
            <div className="card-form-row">
              <label>Choices (Select the radio button for the correct answer)</label>
              <div className="mcq-options-container">
                {(newCard.options || ["", "", "", ""]).map((opt, i) => (
                  <div key={i} className="mcq-option-row">
                    <label className="mcq-radio-label" title="Mark as correct answer">
                      <input
                        type="radio"
                        name="mcq-correct"
                        checked={mcqCorrectIndex === i}
                        onChange={() => {
                          setMcqCorrectIndex(i);
                          setNewCard({ ...newCard, back: opt });
                        }}
                      />
                      <span className="mcq-option-letter">{String.fromCharCode(65 + i)}</span>
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const opts = [...(newCard.options || [])];
                        opts[i] = e.target.value;
                        const isCorrect = mcqCorrectIndex === i;
                        setNewCard({
                          ...newCard,
                          options: opts,
                          ...(isCorrect ? { back: e.target.value } : {}),
                        });
                        if (newCardError) setNewCardError(null);
                      }}
                      placeholder={`Choice ${String.fromCharCode(65 + i)}...`}
                      className={`setup-input ${mcqCorrectIndex === i ? "setup-input--correct" : ""}`}
                    />
                    {(newCard.options?.length || 0) > 2 && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn--danger"
                        onClick={() => {
                          const opts = (newCard.options || []).filter((_, idx) => idx !== i);
                          setNewCard({ ...newCard, options: opts });
                          if (mcqCorrectIndex >= opts.length) {
                            setMcqCorrectIndex(0);
                          }
                        }}
                        title="Remove choice"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {(newCard.options?.length || 0) < 6 && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm mcq-add-btn"
                    onClick={() => {
                      const opts = [...(newCard.options || []), ""];
                      setNewCard({ ...newCard, options: opts });
                    }}
                  >
                    + Add Choice
                  </button>
                )}
              </div>
            </div>
          )}

          {/* True / False Selection */}
          {newCard.type === "truefalse" && (
            <div className="card-form-row">
              <label>Correct Verification</label>
              <div className="tf-radio-group">
                <label className={`chip ${newCard.back?.startsWith("True") ? "chip--active" : ""}`}>
                  <input
                    type="radio"
                    name="tf-answer"
                    checked={newCard.back?.startsWith("True")}
                    onChange={() => setNewCard({ ...newCard, back: "True" })}
                    className="sr-only"
                  />
                  ✓ True
                </label>
                <label className={`chip ${newCard.back?.startsWith("False") ? "chip--active" : ""}`}>
                  <input
                    type="radio"
                    name="tf-answer"
                    checked={newCard.back?.startsWith("False")}
                    onChange={() => setNewCard({ ...newCard, back: "False" })}
                    className="sr-only"
                  />
                  ✕ False
                </label>
              </div>
            </div>
          )}

          {/* Q&A and Cloze Back text */}
          {(newCard.type === "qa" || newCard.type === "cloze") && (
            <div className="card-form-row">
              <label htmlFor="new-card-back">
                {newCard.type === "cloze" ? "Missing Word or Complete Sentence (Back)" : "Answer (Back)"}
              </label>
              <textarea
                id="new-card-back"
                className="card-form-textarea"
                value={newCard.back || ""}
                onChange={(e) => {
                  setNewCard({ ...newCard, back: e.target.value });
                  if (newCardError) setNewCardError(null);
                }}
                rows={3}
                placeholder="Enter the correct answer or explanation..."
              />
            </div>
          )}

          <div className="card-form-row">
            <label htmlFor="new-card-pages">Source Page Number</label>
            <input
              type="text"
              id="new-card-pages"
              value={newCard.sourcePages?.join(", ") || "1"}
              onChange={(e) =>
                setNewCard({
                  ...newCard,
                  sourcePages: e.target.value
                    .split(",")
                    .map((s) => parseInt(s.trim()))
                    .filter((n) => !isNaN(n) && n > 0),
                })
              }
              placeholder="e.g. 1"
              className="setup-input setup-input--small"
            />
          </div>

          <div className="card-form-actions">
            <button className="btn btn--primary" onClick={addNewCard} id="save-new-card-btn">
              ✓ Save Card
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setShowAddCard(false);
                setNewCardError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cards List Header */}
      <div className="editor-cards-count">
        {filteredCards.length} of {deck.cards.length} cards
        {(search || filterType !== "all" || filterPage !== null) && " (filtered)"}
      </div>

      {/* Cards List */}
      <div className="editor-cards" role="list">
        {filteredCards.map((card) => {
          const realIdx = getRealIndex(card.id);
          const isEditing = editingCard === card.id;

          return (
            <article
              key={card.id}
              className={`editor-card editor-card--${card.type}`}
              role="listitem"
              id={`card-${card.id}`}
            >
              {isEditing ? (
                /* Inline Edit Mode */
                <div className="card-form card-form--inline">
                  {editFormError && (
                    <div className="card-form-error" role="alert">
                      <span>⚠️</span> {editFormError}
                    </div>
                  )}

                  <div className="card-form-row">
                    <label>Card Type</label>
                    <select
                      className="setup-input"
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          type: e.target.value as CardType,
                        })
                      }
                    >
                      <option value="qa">Q&A</option>
                      <option value="cloze">Fill-in-the-blank</option>
                      <option value="mcq">Multiple Choice</option>
                      <option value="truefalse">True/False</option>
                    </select>
                  </div>

                  <div className="card-form-row">
                    <label>Front</label>
                    <textarea
                      className="card-form-textarea"
                      value={editForm.front || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, front: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  {editForm.type === "mcq" ? (
                    <div className="card-form-row">
                      <label>Choices (Select radio for correct answer)</label>
                      <div className="mcq-options-container">
                        {(editForm.options || ["", "", "", ""]).map((opt, i) => (
                          <div key={i} className="mcq-option-row">
                            <label className="mcq-radio-label">
                              <input
                                type="radio"
                                name={`edit-mcq-correct-${card.id}`}
                                checked={editForm.back === opt && opt.length > 0}
                                onChange={() =>
                                  setEditForm({ ...editForm, back: opt })
                                }
                              />
                              <span className="mcq-option-letter">{String.fromCharCode(65 + i)}</span>
                            </label>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const opts = [...(editForm.options || [])];
                                const wasCorrect = editForm.back === opts[i];
                                opts[i] = e.target.value;
                                setEditForm({
                                  ...editForm,
                                  options: opts,
                                  ...(wasCorrect ? { back: e.target.value } : {}),
                                });
                              }}
                              className={`setup-input ${editForm.back === opt ? "setup-input--correct" : ""}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="card-form-row">
                      <label>Back</label>
                      <textarea
                        className="card-form-textarea"
                        value={editForm.back || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, back: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="card-form-actions">
                    <button className="btn btn--primary btn--sm" onClick={saveEdit}>
                      ✓ Save
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Card Display Mode */
                <>
                  <div className="editor-card-header">
                    <span className={`card-type-badge card-type-badge--${card.type}`}>
                      {cardTypeLabel(card.type)}
                    </span>
                    <span className="editor-card-pages">
                      p.{card.sourcePages.join(", ")}
                    </span>
                    {card.tags && card.tags.length > 0 && (
                      <span className="card-topic-tag">{card.tags[0]}</span>
                    )}
                  </div>

                  <div className="editor-card-content">
                    <p className="editor-card-front">
                      <strong>Q:</strong> {card.front}
                    </p>
                    <p className="editor-card-back">
                      <strong>A:</strong> {card.back}
                    </p>

                    {card.type === "mcq" && card.options && (
                      <ul className="editor-card-options">
                        {card.options.map((opt, i) => (
                          <li
                            key={i}
                            className={
                              opt === card.back
                                ? "editor-card-option--correct"
                                : ""
                            }
                          >
                            <span className="mcq-badge-letter">{String.fromCharCode(65 + i)}.</span> {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="editor-card-actions">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => startEdit(card)}
                      title="Edit card"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => duplicateCard(card)}
                      title="Duplicate card"
                    >
                      📋 Copy
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => moveCard(realIdx, "up")}
                      disabled={realIdx === 0}
                      title="Move card up"
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => moveCard(realIdx, "down")}
                      disabled={realIdx === deck.cards.length - 1}
                      title="Move card down"
                    >
                      ↓
                    </button>
                    <button
                      className="btn btn--ghost btn--sm btn--danger"
                      onClick={() => deleteCard(card.id)}
                      title="Delete card"
                    >
                      🗑
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}

        {filteredCards.length === 0 && (
          <div className="editor-empty">
            <p>
              {search || filterType !== "all" || filterPage !== null
                ? "No cards match the current filter."
                : "No cards in this deck yet."}
            </p>
            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn--primary"
                onClick={() => setShowAddCard(true)}
              >
                + Create First Card
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="editor-storage-notice">
        <span>💾 Auto-saved to browser storage. Your cards stay private on your machine.</span>
      </div>
    </section>
  );
}
