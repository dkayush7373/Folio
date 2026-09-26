// ─── Home View ──────────────────────────────────────────────────────
// Clean landing: recent decks + create new. No sample placeholders.

import { useApp } from "../context/AppContext";
import { deleteDeck } from "../db";

export default function HomeView() {
  const { state, dispatch, createNewDeck, loadExistingDeck, refreshDeckList } =
    useApp();

  const handleNewDeck = () => {
    createNewDeck("New Deck");
    dispatch({ type: "SET_VIEW", view: "setup" });
  };

  const handleOpenDeck = async (id: string) => {
    await loadExistingDeck(id);
    dispatch({ type: "SET_VIEW", view: "editor" });
  };

  const handleDeleteDeck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this deck? This cannot be undone.")) {
      await deleteDeck(id);
      await refreshDeckList();
    }
  };

  return (
    <div className="home-view">
      <header className="home-hero">
        <h1 className="home-title">Folio</h1>
        <p className="home-subtitle">
          Upload a PDF, get study-ready flashcards in seconds.
        </p>
      </header>

      <div className="home-actions">
        <button
          className="home-action-card home-action-card--primary"
          onClick={handleNewDeck}
          id="new-deck-btn"
        >
          <span className="home-action-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </span>
          <span className="home-action-title">New from PDF</span>
          <span className="home-action-desc">
            Upload a document and generate flashcards
          </span>
        </button>
      </div>

      {/* Empty State Guide */}
      {state.deckList.length === 0 && (
        <div className="home-guide">
          <div className="home-guide-card">
            <span className="home-guide-step">1</span>
            <h4>Upload Any PDF</h4>
            <p>Textbooks, syllabus, lecture slides, research papers, or study notes.</p>
          </div>
          <div className="home-guide-card">
            <span className="home-guide-step">2</span>
            <h4>Topic & Section Analysis</h4>
            <p>Folio reads page boundaries and identifies core definitions and themes.</p>
          </div>
          <div className="home-guide-card">
            <span className="home-guide-step">3</span>
            <h4>Active Recall Study</h4>
            <p>Master the material with questions, cloze fill-ins, and multiple-choice cards.</p>
          </div>
        </div>
      )}

      {/* Recent Decks */}
      {state.deckList.length > 0 && (
        <section className="home-recent" aria-label="Recent decks">
          <h2 className="home-recent-title">Your Decks</h2>
          <div className="home-deck-list" role="list">
            {state.deckList.map((d) => (
              <button
                key={d.id}
                className="home-deck-card"
                onClick={() => handleOpenDeck(d.id)}
                role="listitem"
                id={`deck-${d.id}`}
              >
                <div className="home-deck-info">
                  <h3 className="home-deck-name">{d.title}</h3>
                  <p className="home-deck-meta">
                    {d.cards.length} card{d.cards.length !== 1 ? "s" : ""}
                    {d.subject && ` · ${d.subject}`}
                    {" · "}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="btn btn--ghost btn--sm btn--danger"
                  onClick={(e) => handleDeleteDeck(d.id, e)}
                  aria-label={`Delete ${d.title}`}
                  title="Delete deck"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="home-footer">
        <p>
          Your data stays in this browser. Nothing is uploaded or shared.
        </p>
      </footer>
    </div>
  );
}
