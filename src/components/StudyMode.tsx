// ─── Study Mode ─────────────────────────────────────────────────────
// One card at a time, tap to reveal, prev/next, shuffle, know/review,
// keyboard controls, progress indicator.

import { useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";

export default function StudyMode() {
  const { state, dispatch } = useApp();
  const deck = state.deck;

  const currentCardIndex = state.studyOrder[state.studyIndex];
  const currentCard = deck?.cards[currentCardIndex];
  const totalCards = state.studyOrder.length;
  const knownCount = deck
    ? Object.values(deck.studyProgress).filter((p) => p.known).length
    : 0;

  const reveal = useCallback(() => {
    dispatch({ type: "STUDY_REVEAL" });
  }, [dispatch]);

  const next = useCallback(() => {
    dispatch({ type: "STUDY_NEXT" });
  }, [dispatch]);

  const prev = useCallback(() => {
    dispatch({ type: "STUDY_PREV" });
  }, [dispatch]);

  const markKnown = useCallback(() => {
    if (!currentCard) return;
    dispatch({ type: "STUDY_MARK", cardId: currentCard.id, known: true });
  }, [currentCard, dispatch]);

  const markReview = useCallback(() => {
    if (!currentCard) return;
    dispatch({ type: "STUDY_MARK", cardId: currentCard.id, known: false });
  }, [currentCard, dispatch]);

  const exit = useCallback(() => {
    dispatch({ type: "EXIT_STUDY" });
  }, [dispatch]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (!state.studyRevealed) reveal();
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          if (state.studyRevealed) markKnown();
          else next();
          break;
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          prev();
          break;
        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (state.studyRevealed) markReview();
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (!state.studyRevealed) reveal();
          break;
        case "Escape":
          e.preventDefault();
          exit();
          break;
        case "s":
          e.preventDefault();
          dispatch({ type: "START_STUDY", shuffle: true });
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.studyRevealed, reveal, next, prev, markKnown, markReview, exit, dispatch]);

  if (!deck || !currentCard) {
    return (
      <div className="study-complete">
        <h2>🎉 Session Complete!</h2>
        <p>
          You've reviewed all cards. {knownCount} marked as known out of{" "}
          {deck?.cards.length || 0}.
        </p>
        <button className="btn btn--primary" onClick={exit} id="exit-study-btn">
          Back to Editor
        </button>
      </div>
    );
  }

  const progress = deck.studyProgress[currentCard.id];
  const cardTypeLabels: Record<string, string> = {
    qa: "Q&A",
    cloze: "Fill in the blank",
    mcq: "Multiple Choice",
    truefalse: "True or False",
  };

  return (
    <div className="study-container" role="main" aria-label="Study mode">
      {/* Top bar */}
      <div className="study-topbar">
        <button
          className="btn btn--ghost"
          onClick={exit}
          aria-label="Exit study mode"
          id="exit-study"
        >
          ← Back
        </button>
        <div className="study-progress-text" aria-live="polite">
          Card {state.studyIndex + 1} of {totalCards}
        </div>
        <div className="study-score">
          {knownCount} / {deck.cards.length} known
        </div>
      </div>

      {/* Progress bar */}
      <div className="study-progress-bar">
        <div
          className="study-progress-fill"
          style={{
            width: `${((state.studyIndex + 1) / totalCards) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <div
        className={`study-card ${state.studyRevealed ? "study-card--revealed" : ""}`}
        onClick={() => !state.studyRevealed && reveal()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !state.studyRevealed) {
            e.preventDefault();
            reveal();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={
          state.studyRevealed
            ? "Card revealed. Use arrow keys to navigate."
            : "Click or press Space/Enter to reveal answer"
        }
        id="study-card"
      >
        <div className="study-card-type">
          {cardTypeLabels[currentCard.type] || currentCard.type}
        </div>

        <div className="study-card-front">
          {currentCard.type === "mcq" ? (
            <>
              <p className="study-card-question">{currentCard.front}</p>
              {currentCard.options && (
                <ul className="study-card-mcq-options">
                  {currentCard.options.map((opt, i) => (
                    <li
                      key={i}
                      className={
                        state.studyRevealed && opt === currentCard.back
                          ? "study-card-mcq-correct"
                          : ""
                      }
                    >
                      <span className="study-card-mcq-letter">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="study-card-question">{currentCard.front}</p>
          )}
        </div>

        {!state.studyRevealed && (
          <p className="study-card-tap-hint">Tap to reveal answer</p>
        )}

        {state.studyRevealed && (
          <div className="study-card-back">
            <div className="study-card-divider" />
            <p className="study-card-answer">{currentCard.back}</p>
          </div>
        )}

        <div className="study-card-meta">
          <span>Source: p.{currentCard.sourcePages.join(", ")}</span>
          {progress && <span>Reviewed {progress.reviewCount}×</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="study-actions">
        <button
          className="btn btn--ghost"
          onClick={prev}
          disabled={state.studyIndex === 0}
          aria-label="Previous card"
          id="study-prev"
        >
          ← Prev
        </button>

        {state.studyRevealed ? (
          <div className="study-verdict">
            <button
              className="btn btn--review"
              onClick={markReview}
              aria-label="Review again"
              id="study-review"
            >
              🔄 Review Again
            </button>
            <button
              className="btn btn--known"
              onClick={markKnown}
              aria-label="I know this"
              id="study-known"
            >
              ✅ Know It
            </button>
          </div>
        ) : (
          <button
            className="btn btn--primary"
            onClick={reveal}
            aria-label="Reveal answer"
            id="study-reveal"
          >
            Show Answer
          </button>
        )}

        <button
          className="btn btn--ghost"
          onClick={next}
          disabled={state.studyIndex >= totalCards - 1}
          aria-label="Next card"
          id="study-next"
        >
          Next →
        </button>
      </div>

      {/* Keyboard legend */}
      <div className="study-keyboard-legend" aria-label="Keyboard shortcuts">
        <span><kbd>Space</kbd> Reveal</span>
        <span><kbd>←</kbd> Prev</span>
        <span><kbd>→</kbd> Know It</span>
        <span><kbd>↓</kbd> Review</span>
        <span><kbd>S</kbd> Shuffle</span>
        <span><kbd>Esc</kbd> Exit</span>
      </div>
    </div>
  );
}
