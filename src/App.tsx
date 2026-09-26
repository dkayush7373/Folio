// ─── Main App Component ─────────────────────────────────────────────
// Router between views with appearance CSS variable application.

import { useEffect, useMemo } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import HomeView from "./components/HomeView";
import SetupView from "./components/SetupView";
import DeckEditor from "./components/DeckEditor";
import StudyMode from "./components/StudyMode";
import AppearancePanel from "./components/AppearancePanel";
import { appearanceToCSSVars } from "./utils/appearance";

function AppInner() {
  const { state, dispatch } = useApp();

  // Apply appearance CSS variables
  const cssVars = useMemo(() => {
    if (!state.deck) return {};
    return appearanceToCSSVars(state.deck.appearance);
  }, [state.deck?.appearance]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value);
    }
    return () => {
      for (const key of Object.keys(cssVars)) {
        root.style.removeProperty(key);
      }
    };
  }, [cssVars]);

  // Keyboard shortcut: Ctrl+Z for undo
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && state.currentView === "editor") {
        e.preventDefault();
        dispatch({ type: "POP_UNDO" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.currentView, dispatch]);

  const renderView = () => {
    switch (state.currentView) {
      case "home":
        return <HomeView />;
      case "setup":
        return <SetupView />;
      case "editor":
        return <DeckEditor />;
      case "study":
        return <StudyMode />;
      case "appearance":
        return <AppearancePanel />;
    }
  };

  return (
    <div className="app" id="folio-app">
      {/* Screen reader live region for status updates */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        id="sr-status"
      >
        {state.saveStatus === "saving" && "Saving changes..."}
        {state.saveStatus === "saved" && "All changes saved."}
        {state.generating && "Generating flashcards..."}
      </div>

      {renderView()}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
