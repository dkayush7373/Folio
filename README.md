# Folio — PDF → Flashcard Study App

Turn any PDF into smart, editable, source-linked flashcards. Study them with keyboard-driven review, export to CSV, and customize the look and feel.

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE` | No | Base URL for your AI proxy server (e.g. `http://localhost:3001`). Without this, Folio loads a sample deck instead of generating from PDFs. |

Create a `.env` file in the project root:

```env
VITE_API_BASE=http://localhost:3001
```

### AI Proxy Server

Folio **never exposes an API key in client code**. You must run a backend proxy that:
1. Accepts POST requests at `{VITE_API_BASE}/api/generate` with `{ prompt: string }` body
2. Forwards the prompt to your LLM provider (OpenAI, Anthropic, Google, etc.)
3. Returns `{ content: string }` with the LLM response

Without this, Folio operates in **sample mode** — a clearly-labeled pre-built deck for exploring the UI.

## Tech Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Dexie.js** — IndexedDB wrapper for local persistence
- **pdf.js** — Client-side PDF text extraction
- **Zod** — Runtime schema validation at every boundary
- **string-similarity-js** — Card deduplication

## Features

### Upload & Extract (Phase 2)
- Drag-and-drop or file picker
- Validates file type, 25 MB cap, corruption, password protection, empty documents
- Extracts text preserving page boundaries
- Real-time progress indicator

### Deck Configuration (Phase 3)
- Page range selector with live validation
- Deck size: short / standard / detailed
- Card types: Q&A, Cloze, MCQ, True/False (mix supported)
- Difficulty, answer length, topic focus & exclusions, output language

### AI Generation (Phase 4)
- Server-side only via proxy — API key never in client code
- Provider consent notice before sending
- Chunked processing (~5 pages/call) with concurrency cap of 3
- Zod validation on every response; retry once on failure
- Failed chunks don't discard successful ones — retry individually
- Near-duplicate detection via string similarity
- Falls back to labeled sample deck when no provider is configured

### Deck Editor (Phase 5)
- Edit front/back, change card type, add/delete/duplicate/reorder
- Search by text, filter by type or source page
- Rename deck, set subject/tags
- Undo last destructive action
- Visible save status at all times

### Appearance (Phase 6)
- 6 curated presets (Midnight, Ocean Breeze, Forest, Sunset, Paper Light, Slate)
- Full custom controls: background/accent color, font, font size, layout
- Live preview card
- WCAG AA contrast checking with inline warnings
- One-click reset to default

### Study Mode (Phase 7)
- One card at a time, click/tap to reveal
- Previous/Next navigation
- Shuffle mode
- "Know It" / "Review Again" (re-queues within session)
- Progress indicator: "Card 4 of 20"
- Full keyboard control with visible on-screen legend

### Persistence & Export (Phase 8)
- IndexedDB via Dexie.js — survives refresh
- CSV export with proper RFC 4180 escaping (commas, quotes, newlines)
- Local-only notice clearly visible
- Multi-tab safe via `updatedAt`-based last-write-wins

### Accessibility (Phase 9)
- Semantic HTML throughout
- Accessible labels on all interactive elements
- Visible keyboard focus indicators
- Screen-reader live regions for save/generation status
- System font fallbacks
- Responsive at 375px, 768px, and 1440px

## Explicitly Deferred (v2+)

The following are **out of scope for v1** and are not built:
- OCR for scanned/image-only PDFs
- Printable PDF export
- Anki (.apkg) export
- Cloud sync / accounts
- Full spaced-repetition scheduling (SM-2, FSRS, etc.)

## Project Structure

```
src/
├── types/          # TypeScript types & FolioError
├── schemas/        # Zod validation schemas & migration
├── db/             # Dexie.js IndexedDB layer
├── services/       # PDF processor, AI generator, CSV export, sample deck
├── utils/          # Appearance utilities, contrast checking
├── context/        # React context + reducer state management
├── components/     # UI components
│   ├── HomeView.tsx
│   ├── PDFUpload.tsx
│   ├── DeckSetup.tsx
│   ├── SetupView.tsx
│   ├── GenerationProgress.tsx
│   ├── DeckEditor.tsx
│   ├── StudyMode.tsx
│   └── AppearancePanel.tsx
├── App.tsx         # Main app shell
├── main.tsx        # Entry point
└── index.css       # Global styles
```

## Building for Production

```bash
npm run build
```

Output is in `dist/`.
