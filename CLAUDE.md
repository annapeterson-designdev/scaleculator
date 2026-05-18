# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Scaleculator is a Chrome extension (Manifest V3) that injects a floating recipe-scaling calculator into any webpage. There is no build step — all source files are loaded directly by Chrome.

## Loading / reloading the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/`
4. After any code change, click **Reload** on the extension card (or use the reload shortcut)

Content scripts are injected into existing tabs only after a full page reload — refreshing the tab is required to see changes on already-open pages.

## Architecture

All extension logic lives in two files injected into every page:

- **`extension/content.js`** — single IIFE; guards against double-injection with an `id` check. Contains:
  - Unit conversion tables (`VOLUME_TO_ML`, `WEIGHT_TO_G`) and `normalize()` / `scaleQty()` helpers
  - `parseRecipeFromPage()` — extracts recipe data from schema.org JSON-LD (`<script type="application/ld+json">`) and microdata
  - `parseIngredientString()` — regex-based parser for strings like "2 cups flour"
  - `isRecipePage()` — detection heuristics (JSON-LD type check, microdata, common CSS selectors)
  - DOM rendering functions (`renderIngredients`, `renderPreviews`, `setScale`)
  - Drag-to-move logic attached to `#sc-header`
  - `window._sc` — namespace for functions called from inline `onclick` handlers in injected HTML

- **`extension/content.css`** — all styles scoped to `#scaleculator-*` and `.sc-*` prefixes to avoid colliding with host page styles

- **`extension/manifest.json`** — MV3, `"matches": ["<all_urls>"]`, `"run_at": "document_idle"`, `storage` permission for `localStorage`-based recipe saving

## Key conventions

- Inline `onclick` handlers in injected HTML must call `window._sc.*` because the content script scope is not accessible from inline handlers.
- The panel starts anchored via CSS `bottom`/`right`. On first drag, the JS switches it to `top`/`left` positioning.
- Saved recipes are stored in the **host page's `localStorage`**, not Chrome's `storage` API — this means saves are per-origin, not global across sites.
- Icons are generated programmatically via Python (`python3`) using only stdlib (`struct`, `zlib`) — no image editor needed.
