// ─── PDF Processing ─────────────────────────────────────────────────
// Uses pdf.js to extract structured text with page boundaries and topic detection.
// Works reliably across all environments without worker resolution failures.

import * as pdfjsLib from "pdfjs-dist";
import { FolioError } from "../types";

export interface PDFPageText {
  pageNumber: number;
  text: string;
}

export interface DetectedTopic {
  title: string;
  pageNumber: number;
  snippet?: string;
}

export interface PDFExtractionResult {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: PDFPageText[];
  detectedTitle?: string;
  detectedTopics: DetectedTopic[];
  summarySnippet?: string;
  totalWords: number;
}

export type ExtractionProgress = {
  phase: "loading" | "extracting";
  current: number;
  total: number;
};

// Configure PDF.js worker
function configureWorker() {
  if (typeof window === "undefined") return;

  try {
    // Primary: use locally hosted worker from public/
    const origin = window.location.origin;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;
  } catch {
    // Fallback: unpkg CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

// ─── Topic & Header Heuristics ──────────────────────────────────────

function extractTopicsFromPages(pages: PDFPageText[]): DetectedTopic[] {
  const topics: DetectedTopic[] = [];
  const seen = new Set<string>();

  const headingPatterns = [
    // Chapter / Section / Unit
    /^(?:Chapter|Section|Unit|Module|Part|Lecture)\s+(\d+|[IVXLCDM]+)[:.\s]+([^\n]{3,60})/i,
    // Numbered outline: 1. Introduction or 2.1 Cellular Structure
    /^(\d+(?:\.\d+)?)\s+([A-Z][A-Za-z0-9\s,&'-]{3,60})$/,
    // All caps or title-case short lines followed by content
    /^([A-Z][A-Z0-9\s,&'-]{3,50})$/,
    // Definition key: Topic Name:
    /^([A-Z][A-Za-z0-9\s]{2,40}):\s*$/,
  ];

  for (const page of pages) {
    const lines = page.text.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines that look like page numbers, URLs, or metadata
      if (/^(?:page\s+\d+|\d+$|https?:\/\/|www\.|copyright|all rights)/i.test(line)) {
        continue;
      }

      for (const pattern of headingPatterns) {
        const match = line.match(pattern);
        if (match) {
          const rawTitle = (match[2] || match[1] || line).trim();
          const cleanTitle = rawTitle
            .replace(/^[:.\-\s]+|[:.\-\s]+$/g, "")
            .replace(/\s+/g, " ");

          const normalized = cleanTitle.toLowerCase();
          if (
            cleanTitle.length >= 3 &&
            cleanTitle.length <= 60 &&
            !seen.has(normalized) &&
            !/^(?:contents?|index|introduction|summary|conclusion|overview)$/i.test(normalized)
          ) {
            seen.add(normalized);
            // Grab next line as snippet if available
            const snippet = lines[i + 1]?.slice(0, 120);
            topics.push({
              title: cleanTitle,
              pageNumber: page.pageNumber,
              snippet,
            });
            break;
          }
        }
      }

      if (topics.length >= 15) break; // Keep most prominent
    }
  }

  // Fallback: If no structured headings found, look for common repeated concepts
  if (topics.length === 0) {
    const termFrequency = new Map<string, { count: number; page: number }>();
    const termRegex = /\b([A-Z][a-z]{3,20}(?:\s+[A-Z][a-z]{3,20})?)\b/g;

    for (const page of pages) {
      let m;
      while ((m = termRegex.exec(page.text)) !== null) {
        const term = m[1].trim();
        if (
          !/^(?:The|This|That|These|Those|With|From|Have|Been|When|Where|Which|What|Some|More|Most|Each|Other|Such|Also|Many|Both)\b/.test(term)
        ) {
          const current = termFrequency.get(term) || { count: 0, page: page.pageNumber };
          termFrequency.set(term, { count: current.count + 1, page: current.page });
        }
      }
    }

    const sortedTerms = Array.from(termFrequency.entries())
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);

    for (const [term, data] of sortedTerms) {
      topics.push({
        title: term,
        pageNumber: data.page,
      });
    }
  }

  return topics;
}

function detectDocumentTitle(
  fileName: string,
  metaTitle: string | undefined,
  pages: PDFPageText[]
): string {
  if (metaTitle && metaTitle.trim().length > 3 && !metaTitle.includes(".pdf")) {
    return metaTitle.trim();
  }

  // Look at page 1 for the largest/first prominent line
  if (pages.length > 0 && pages[0].text) {
    const lines = pages[0].text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines.slice(0, 5)) {
      if (
        line.length >= 4 &&
        line.length <= 80 &&
        !/^(page|\d+|http|www|copyright|all rights)/i.test(line)
      ) {
        return line;
      }
    }
  }

  // Clean filename fallback: replace underscores/dashes with spaces, strip .pdf
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── Main PDF Text Extractor ────────────────────────────────────────

export async function extractPDFText(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<PDFExtractionResult> {
  // Validate file type
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new FolioError("InvalidFileError", "File must be a PDF document.");
  }

  // Validate file size (25MB cap)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new FolioError(
      "InvalidFileError",
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 25MB limit.`
    );
  }

  configureWorker();

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ phase: "loading", current: 0, total: 1 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    pdf = await loadingTask.promise;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      throw new FolioError(
        "PasswordProtectedError",
        "This PDF is password-protected. Please remove the password and try again."
      );
    }
    throw new FolioError(
      "InvalidFileError",
      `Unable to read this PDF document: ${message}`
    );
  }

  const pageCount = pdf.numPages;
  if (pageCount === 0) {
    throw new FolioError("EmptyDocumentError", "This PDF contains no pages.");
  }

  // Extract metadata if available
  let metaTitle: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (meta?.info && (meta.info as any).Title) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metaTitle = String((meta.info as any).Title);
    }
  } catch {
    // Ignore metadata failure
  }

  const pages: PDFPageText[] = [];
  let hasAnyText = false;
  let totalWords = 0;

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.({ phase: "extracting", current: i, total: pageCount });

    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      let pageText = "";
      let lastY: number | null = null;
      let lastX: number | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of textContent.items as any[]) {
        if (typeof item.str !== "string") continue;
        const str = item.str;
        if (!str && !item.hasEOL) continue;

        const currentY = item.transform?.[5];
        const currentX = item.transform?.[4];

        if (lastY !== null && currentY !== undefined && Math.abs(currentY - lastY) > 8) {
          pageText += "\n";
        } else if (item.hasEOL) {
          pageText += "\n";
        } else if (lastX !== null && currentX !== undefined && currentX - lastX > 5) {
          if (!pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            pageText += " ";
          }
        }

        pageText += str;
        if (currentY !== undefined) lastY = currentY;
        if (currentX !== undefined) lastX = currentX + (item.width || str.length * 6);
      }

      const cleanText = pageText
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

      if (cleanText.length > 0) {
        hasAnyText = true;
        totalWords += cleanText.split(/\s+/).length;
      }

      pages.push({ pageNumber: i, text: cleanText });
    } catch {
      // If a single page fails, record empty page and continue
      pages.push({ pageNumber: i, text: "" });
    }
  }

  if (!hasAnyText) {
    throw new FolioError(
      "EmptyDocumentError",
      "No readable text found in this PDF. It may consist of scanned images without text layer (OCR is not supported)."
    );
  }

  const detectedTitle = detectDocumentTitle(file.name, metaTitle, pages);
  const detectedTopics = extractTopicsFromPages(pages);

  // Generate a concise snippet from the first substantive page
  let summarySnippet = "";
  for (const page of pages) {
    if (page.text.length > 60) {
      summarySnippet = page.text.slice(0, 200).replace(/\n+/g, " ").trim() + "...";
      break;
    }
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    pageCount,
    pages,
    detectedTitle,
    detectedTopics,
    summarySnippet,
    totalWords,
  };
}

// Get page numbers that actually contain text
export function getTextPages(pages: PDFPageText[]): number[] {
  return pages.filter((p) => p.text.trim().length > 0).map((p) => p.pageNumber);
}

// Chunk pages for batch processing (~3-5 pages per chunk)
export function chunkPages(
  pages: PDFPageText[],
  startPage: number,
  endPage: number,
  chunkSize: number = 4
): PDFPageText[][] {
  const filtered = pages.filter(
    (p) => p.pageNumber >= startPage && p.pageNumber <= endPage && p.text.trim().length > 0
  );
  const chunks: PDFPageText[][] = [];
  for (let i = 0; i < filtered.length; i += chunkSize) {
    chunks.push(filtered.slice(i, i + chunkSize));
  }
  return chunks;
}
