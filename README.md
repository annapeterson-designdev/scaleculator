# Scaleculator

A recipe scaling tool — available as both a standalone web app and a Chrome extension. Scale any recipe up or down instantly, with automatic unit conversion.

## Features

- Scale recipes to ¼x, ½x, 1x, 2x, 3x, 4x or any custom factor
- Automatically converts units (e.g. 3 tsp → 1 tbsp, 2 cups → 1 pint)
- Import ingredients directly from a recipe URL
- Scale to a single serving when a recipe has yield info
- Save and manage multiple recipes locally
- Copy the scaled ingredient list to your clipboard

## Web App

Open `index.html` in any browser — no server or build step needed.

## Chrome Extension

The extension injects a floating panel onto any webpage, and auto-detects recipe ingredients on recipe sites.

**To install:**

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder
4. Visit any recipe page — the Scaleculator panel will appear automatically

After editing any source file, click **Reload** on the extension card in `chrome://extensions`, then refresh the tab.

## Project Structure

```
index.html              # Standalone web app
extension/
  manifest.json         # Chrome extension manifest (MV3)
  content.js            # Injected script — all extension logic
  content.css           # Scoped styles for the injected panel
  icons/                # Extension icons (16, 48, 128px)
```

## Supported Units

**Volume:** tsp, tbsp, fl oz, cup, pint, quart, gallon, ml, L

**Weight:** oz, lb, g, kg

**Other:** piece, pinch, dash, clove, slice, can, pkg, bunch, handful, to taste
