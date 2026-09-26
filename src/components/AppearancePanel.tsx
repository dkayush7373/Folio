// ─── Appearance Settings Panel ──────────────────────────────────────
// Presets, custom controls, live preview, WCAG contrast warnings.

import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { AppearanceSettings } from "../types";
import {
  presets,
  meetsWCAGAA,
  getTextColorForBg,
  contrastRatio,
} from "../utils/appearance";

export default function AppearancePanel() {
  const { state, dispatch } = useApp();
  const deck = state.deck;
  const appearance = deck?.appearance;

  const [tab, setTab] = useState<"presets" | "custom">("presets");

  const textColor = useMemo(
    () => (appearance ? getTextColorForBg(appearance.backgroundColor) : "#f0f0f5"),
    [appearance]
  );

  const contrastOk = useMemo(() => {
    if (!appearance) return true;
    return meetsWCAGAA(appearance.backgroundColor, textColor);
  }, [appearance, textColor]);

  const accentContrastOk = useMemo(() => {
    if (!appearance) return true;
    return meetsWCAGAA(appearance.backgroundColor, appearance.accentColor);
  }, [appearance]);

  const ratio = useMemo(() => {
    if (!appearance) return 0;
    return contrastRatio(appearance.backgroundColor, textColor);
  }, [appearance, textColor]);

  if (!deck || !appearance) return null;

  const update = (partial: Partial<AppearanceSettings>) => {
    dispatch({
      type: "SET_APPEARANCE",
      appearance: { ...appearance, ...partial, preset: "custom" },
    });
  };

  const applyPreset = (preset: (typeof presets)[number]) => {
    dispatch({ type: "SET_APPEARANCE", appearance: { ...preset.settings } });
  };

  const resetToDefault = () => {
    applyPreset(presets[0]);
  };

  return (
    <section className="appearance-section" aria-label="Appearance Settings">
      <div className="appearance-header">
        <h2 className="appearance-title">Appearance</h2>
        <button
          className="btn btn--ghost"
          onClick={() => dispatch({ type: "SET_VIEW", view: "editor" })}
          id="close-appearance"
        >
          ← Back to Editor
        </button>
      </div>

      {/* Tabs */}
      <div className="appearance-tabs" role="tablist">
        <button
          role="tab"
          className={`appearance-tab ${tab === "presets" ? "appearance-tab--active" : ""}`}
          onClick={() => setTab("presets")}
          aria-selected={tab === "presets"}
          id="tab-presets"
        >
          Presets
        </button>
        <button
          role="tab"
          className={`appearance-tab ${tab === "custom" ? "appearance-tab--active" : ""}`}
          onClick={() => setTab("custom")}
          aria-selected={tab === "custom"}
          id="tab-custom"
        >
          Custom
        </button>
      </div>

      {/* Presets */}
      {tab === "presets" && (
        <div className="appearance-presets" role="tabpanel">
          {presets.map((preset) => (
            <button
              key={preset.name}
              className={`appearance-preset ${appearance.preset === preset.name ? "appearance-preset--active" : ""}`}
              onClick={() => applyPreset(preset)}
              style={{
                "--preview-bg": preset.settings.backgroundColor,
                "--preview-accent": preset.settings.accentColor,
                "--preview-text": getTextColorForBg(
                  preset.settings.backgroundColor
                ),
              } as React.CSSProperties}
              id={`preset-${preset.name}`}
            >
              <div className="appearance-preset-preview">
                <div className="appearance-preset-swatch" />
                <div className="appearance-preset-accent-swatch" />
              </div>
              <span className="appearance-preset-name">{preset.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Custom */}
      {tab === "custom" && (
        <div className="appearance-custom" role="tabpanel">
          <div className="appearance-control">
            <label htmlFor="bg-color">Background Color</label>
            <div className="appearance-color-input">
              <input
                type="color"
                id="bg-color"
                value={appearance.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
              />
              <input
                type="text"
                value={appearance.backgroundColor}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="setup-input setup-input--small"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>

          <div className="appearance-control">
            <label htmlFor="accent-color">Accent Color</label>
            <div className="appearance-color-input">
              <input
                type="color"
                id="accent-color"
                value={appearance.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
              />
              <input
                type="text"
                value={appearance.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="setup-input setup-input--small"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>

          <div className="appearance-control">
            <label htmlFor="font-family">Font</label>
            <select
              id="font-family"
              value={appearance.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="editor-filter-select"
            >
              <option value="'Inter', system-ui, sans-serif">Inter</option>
              <option value="'Georgia', serif">Georgia</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              <option value="system-ui, sans-serif">System UI</option>
              <option value="'Outfit', sans-serif">Outfit</option>
            </select>
          </div>

          <div className="appearance-control">
            <label htmlFor="font-size">
              Font Size: {appearance.fontSize}px
            </label>
            <input
              type="range"
              id="font-size"
              min={10}
              max={32}
              value={appearance.fontSize}
              onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
              className="appearance-range"
            />
          </div>

          <div className="appearance-control">
            <label htmlFor="layout">Layout</label>
            <div className="setup-chips">
              {(["compact", "classic", "wide"] as const).map((l) => (
                <button
                  key={l}
                  className={`chip ${appearance.layout === l ? "chip--active" : ""}`}
                  onClick={() => update({ layout: l })}
                  id={`layout-${l}`}
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Contrast warning */}
          {(!contrastOk || !accentContrastOk) && (
            <div className="appearance-contrast-warning" role="alert" id="contrast-warning">
              <span className="appearance-warning-icon">⚠️</span>
              <div>
                <strong>Low contrast detected</strong>
                <p>
                  Contrast ratio: {ratio.toFixed(1)}:1 (WCAG AA requires at
                  least 4.5:1).
                  {!accentContrastOk &&
                    " The accent color also has insufficient contrast against the background."}
                </p>
                <p>
                  Consider choosing colors with higher contrast for
                  accessibility.
                </p>
              </div>
            </div>
          )}

          <button
            className="btn btn--secondary"
            onClick={resetToDefault}
            id="reset-appearance"
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Live Preview */}
      <div className="appearance-preview" aria-label="Live preview">
        <h3 className="appearance-preview-title">Live Preview</h3>
        <div
          className="appearance-preview-card"
          style={{
            backgroundColor: appearance.backgroundColor,
            color: textColor,
            fontFamily: appearance.fontFamily,
            fontSize: `${appearance.fontSize}px`,
            borderColor: appearance.accentColor,
          }}
        >
          <div
            className="appearance-preview-badge"
            style={{
              backgroundColor: appearance.accentColor,
              color: getTextColorForBg(appearance.accentColor),
            }}
          >
            Q&A
          </div>
          <p style={{ fontWeight: 600 }}>What is photosynthesis?</p>
          <div
            style={{
              borderTop: `1px solid ${appearance.accentColor}40`,
              paddingTop: "12px",
              marginTop: "12px",
              opacity: 0.85,
            }}
          >
            <p>
              Photosynthesis is the process by which green plants convert
              sunlight into chemical energy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
