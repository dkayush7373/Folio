// ─── Generation Progress ────────────────────────────────────────────
// Shows per-chunk status during AI generation with retry capability.

import type { GenerationProgress, ChunkStatus } from "../services/aiGenerator";

interface GenerationProgressViewProps {
  progress: GenerationProgress | null;
  onRetryChunk?: (chunkIndex: number) => void;
}

export default function GenerationProgressView({
  progress,
  onRetryChunk,
}: GenerationProgressViewProps) {
  if (!progress) return null;

  const statusIcon = (status: ChunkStatus["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "processing":
        return "⚙️";
      case "retrying":
        return "🔄";
      case "success":
        return "✅";
      case "failed":
        return "❌";
    }
  };

  const statusLabel = (status: ChunkStatus["status"]) => {
    switch (status) {
      case "pending":
        return "Waiting";
      case "processing":
        return "Processing";
      case "retrying":
        return "Retrying";
      case "success":
        return "Complete";
      case "failed":
        return "Failed";
    }
  };

  const percent = Math.round(
    (progress.completedChunks / progress.totalChunks) * 100
  );

  return (
    <div
      className="gen-progress"
      role="status"
      aria-live="polite"
      aria-label="Generation progress"
    >
      <h3 className="gen-progress-title">Generating Flashcards</h3>
      <div className="gen-progress-summary">
        <span>
          {progress.completedChunks} of {progress.totalChunks} chunks · {progress.totalCards} cards generated
        </span>
      </div>
      <div className="gen-progress-bar">
        <div
          className="gen-progress-fill"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <ul className="gen-chunk-list">
        {progress.chunks.map((chunk) => (
          <li
            key={chunk.chunkIndex}
            className={`gen-chunk gen-chunk--${chunk.status}`}
          >
            <span className="gen-chunk-icon">{statusIcon(chunk.status)}</span>
            <span className="gen-chunk-range">Pages {chunk.pageRange}</span>
            <span className="gen-chunk-status">
              {statusLabel(chunk.status)}
              {chunk.status === "success" && ` · ${chunk.cards.length} cards`}
            </span>
            {chunk.status === "failed" && (
              <div className="gen-chunk-error">
                <span className="gen-chunk-error-text">{chunk.error}</span>
                {onRetryChunk && (
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => onRetryChunk(chunk.chunkIndex)}
                    id={`retry-chunk-${chunk.chunkIndex}`}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
