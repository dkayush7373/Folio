// ─── PDF Upload Component ───────────────────────────────────────────
// Drag-and-drop + file picker with validation, progress, and document summary.

import { useState, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import {
  extractPDFText,
  type ExtractionProgress,
} from "../services/pdfProcessor";
import { FolioError } from "../types";

export default function PDFUpload() {
  const { state, dispatch } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      dispatch({ type: "SET_PDF_LOADING", loading: true });
      dispatch({ type: "SET_PDF_ERROR", error: null });
      setProgress(null);

      try {
        const result = await extractPDFText(file, (p) => setProgress(p));
        dispatch({ type: "SET_PDF_DATA", data: result });
      } catch (err) {
        const message =
          err instanceof FolioError
            ? err.message
            : "An unexpected error occurred while processing the PDF.";
        dispatch({ type: "SET_PDF_ERROR", error: message });
      } finally {
        setProgress(null);
      }
    },
    [dispatch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClear = useCallback(() => {
    dispatch({ type: "CLEAR_PDF" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [dispatch]);

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <section className="upload-section" aria-label="PDF Upload">
      {!state.pdfData && !state.pdfLoading && (
        <div
          className={`upload-dropzone ${dragOver ? "upload-dropzone--active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Drop a PDF file here or click to browse"
          id="pdf-upload-dropzone"
        >
          <div className="upload-icon">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <p className="upload-text">
            <strong>Choose a PDF file</strong> or drag and drop it here
          </p>
          <p className="upload-hint">Textbooks, lecture notes, academic papers, slides (up to 25 MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            className="upload-input-hidden"
            aria-hidden="true"
            tabIndex={-1}
            id="pdf-file-input"
          />
        </div>
      )}

      {state.pdfLoading && (
        <div className="upload-progress" role="status" aria-live="polite">
          <div className="upload-progress-spinner" />
          <p className="upload-progress-text">
            {progress
              ? progress.phase === "loading"
                ? "Opening PDF document..."
                : `Reading content — page ${progress.current} of ${progress.total}`
              : "Reading document..."}
          </p>
          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {state.pdfError && (
        <div className="upload-error" role="alert">
          <div className="upload-error-icon">Notice:</div>
          <p className="upload-error-text">{state.pdfError}</p>
          <button
            className="btn btn--secondary"
            onClick={handleClear}
            id="upload-retry-btn"
          >
            Select another document
          </button>
        </div>
      )}

      {state.pdfData && !state.pdfLoading && (
        <div className="upload-success">
          <div className="upload-file-info">
            <div className="upload-file-icon">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            <div className="upload-file-details">
              <h3 className="upload-file-name">
                {state.pdfData.detectedTitle || state.pdfData.fileName}
              </h3>
              <p className="upload-file-meta">
                {state.pdfData.pageCount} pages · {(state.pdfData.fileSize / (1024 * 1024)).toFixed(1)} MB
                {state.pdfData.totalWords ? ` · ~${state.pdfData.totalWords.toLocaleString()} words` : ""}
              </p>
            </div>
            <button
              className="btn btn--ghost btn--icon"
              onClick={handleClear}
              aria-label="Remove document"
              title="Remove document"
              id="remove-pdf-btn"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {state.pdfData.summarySnippet && (
            <div className="upload-doc-snippet">
              <span className="upload-doc-snippet-label">Document Opening:</span>
              <p className="upload-doc-snippet-text">"{state.pdfData.summarySnippet}"</p>
            </div>
          )}

          {state.pdfData.detectedTopics && state.pdfData.detectedTopics.length > 0 && (
            <div className="upload-topics-preview">
              <span className="upload-topics-label">
                Identified {state.pdfData.detectedTopics.length} Key Topics from PDF:
              </span>
              <div className="upload-topics-chips">
                {state.pdfData.detectedTopics.slice(0, 6).map((topic, i) => (
                  <span key={i} className="upload-topic-tag">
                    {topic.title}
                  </span>
                ))}
                {state.pdfData.detectedTopics.length > 6 && (
                  <span className="upload-topic-tag upload-topic-tag--more">
                    +{state.pdfData.detectedTopics.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
