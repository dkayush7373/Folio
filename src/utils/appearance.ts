// ─── Appearance Utilities ───────────────────────────────────────────
// Presets, WCAG AA contrast checking, and defaults.
// Light, human-crafted themes — warm, readable, natural.

import type { AppearanceSettings } from "../types";

// ─── WCAG Contrast ──────────────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRGB(hex1);
  const [r2, g2, b2] = hexToRGB(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAGAA(bgHex: string, fgHex: string): boolean {
  return contrastRatio(bgHex, fgHex) >= 4.5;
}

// Text color for a given background (prioritizing high-contrast, comfortable reading)
export function getTextColorForBg(bgHex: string): string {
  const [r, g, b] = hexToRGB(bgHex);
  const luminance = relativeLuminance(r, g, b);
  return luminance > 0.35 ? "#1f2937" : "#fbfbfa";
}

// ─── Presets (All Light, Warm, Human-Crafted) ─────────────────────────

export interface AppearancePreset {
  name: string;
  label: string;
  settings: AppearanceSettings;
}

export const presets: AppearancePreset[] = [
  {
    name: "paper",
    label: "Editorial Paper",
    settings: {
      backgroundColor: "#faf8f5",
      accentColor: "#c2410c",
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: 16,
      layout: "classic",
      preset: "paper",
    },
  },
  {
    name: "studio",
    label: "Clean Studio",
    settings: {
      backgroundColor: "#ffffff",
      accentColor: "#2563eb",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 16,
      layout: "classic",
      preset: "studio",
    },
  },
  {
    name: "sage",
    label: "Linen & Sage",
    settings: {
      backgroundColor: "#f4f7f4",
      accentColor: "#2d6a4f",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 16,
      layout: "classic",
      preset: "sage",
    },
  },
  {
    name: "sandstone",
    label: "Warm Sandstone",
    settings: {
      backgroundColor: "#f9f6f0",
      accentColor: "#b45309",
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: 17,
      layout: "wide",
      preset: "sandstone",
    },
  },
  {
    name: "nordic",
    label: "Nordic Daylight",
    settings: {
      backgroundColor: "#f6f8fb",
      accentColor: "#0284c7",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 16,
      layout: "classic",
      preset: "nordic",
    },
  },
  {
    name: "heather",
    label: "Soft Heather",
    settings: {
      backgroundColor: "#f8f7fc",
      accentColor: "#4f46e5",
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 16,
      layout: "compact",
      preset: "heather",
    },
  },
];

export function defaultAppearance(): AppearanceSettings {
  return { ...presets[0].settings };
}

export function getPreset(name: string): AppearancePreset | undefined {
  return presets.find((p) => p.name === name);
}

// ─── CSS Variables ──────────────────────────────────────────────────

export function appearanceToCSSVars(a: AppearanceSettings): Record<string, string> {
  const isDark = relativeLuminance(...hexToRGB(a.backgroundColor)) <= 0.35;
  const textColor = isDark ? "#fbfbfa" : "#1f2937";
  const textMuted = isDark ? "#a1a1aa" : "#57534e";
  const textSubtle = isDark ? "#71717a" : "#8c877e";

  const surfaceColor = isDark
    ? adjustBrightness(a.backgroundColor, 14)
    : "#ffffff";
  const surfaceAltColor = isDark
    ? adjustBrightness(a.backgroundColor, 8)
    : adjustBrightness(a.backgroundColor, -6);
  const borderColor = isDark
    ? adjustBrightness(a.backgroundColor, 26)
    : "#e5e5df";
  const borderStrongColor = isDark
    ? adjustBrightness(a.backgroundColor, 38)
    : "#d4d0c8";

  return {
    "--folio-bg": a.backgroundColor,
    "--folio-surface": surfaceColor,
    "--folio-surface-alt": surfaceAltColor,
    "--folio-border": borderColor,
    "--folio-border-strong": borderStrongColor,
    "--folio-accent": a.accentColor,
    "--folio-accent-hover": adjustBrightness(a.accentColor, -15),
    "--folio-accent-light": isDark ? "rgba(255,255,255,0.08)" : `${a.accentColor}12`,
    "--folio-text": textColor,
    "--folio-text-muted": textMuted,
    "--folio-text-subtle": textSubtle,
    "--folio-font": a.fontFamily,
    "--folio-font-size": `${a.fontSize}px`,
    "--folio-radius": a.layout === "compact" ? "8px" : a.layout === "wide" ? "14px" : "10px",
    "--folio-card-max-width": a.layout === "compact" ? "480px" : a.layout === "wide" ? "720px" : "600px",
  };
}

function adjustBrightness(hex: string, amount: number): string {
  const [r, g, b] = hexToRGB(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const nr = clamp(r + amount);
  const ng = clamp(g + amount);
  const nb = clamp(b + amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}
