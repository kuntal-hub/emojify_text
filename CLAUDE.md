# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Emojify Text: a static site (no build step, no dependencies, no `package.json`) that turns text into big letters made of emojis for pasting into WhatsApp, Instagram and Facebook. Live at https://kuntal-hub.github.io/emojify_text/ (GitHub Pages, served straight from the repo root).

## Commands

```sh
npx serve .                                   # run locally (or just open index.html)
node --test tests/art.test.js                 # all tests (not `node --test tests/`: Node 24 treats the dir as a file and fails)
node --test --test-name-pattern="spacing" tests/art.test.js   # tests whose name matches
```

## Architecture

Three plain scripts, loaded in order by `index.html`, sharing globals:

1. `font.js` defines global `FONT`: each glyph is 7 strings of `#`/`.` (1-pixel strokes). Also exports via `module.exports` for Node.
2. `art.js` defines global `EmojiArt` (an IIFE). All pure logic: grapheme splitting, text → 2D emoji grid (`buildGrid`), depth scaling with diagonal corner smoothing (`glyphMask`), platform copy formatting (`formatForPlatform`), and design-link encoding. It must stay DOM-free so `tests/art.test.js` can `require` it in Node; it falls back to `require("./font.js")` when `FONT` isn't global.
3. `script.js` is the UI (one IIFE). A single `state` object drives everything: `update()` rebuilds `grid` via `EmojiArt.buildGrid` + `trimGrid`, then re-renders the preview; `artText()` formats the grid for the chosen platform when copying/sharing.

Grid model: rows of cells, each an emoji string or `null`. Depth (1–3) scales strokes; letters on a line share a baseline; gaps between letters equal the larger neighbouring depth; spaces are `3 × depth` wide.

### Paste alignment (the main quality bar)

Users mostly paste the copied text into chat apps, so what matters is how it lines up as plain text in the app's fonts, not the on-page preview. The mechanisms in `art.js`:

- Invisible blanks are U+3000 plus a fixed-width Unicode space (`BLANKS`: 1, 7/6, 1.25, 4/3, 1.5em). The spacing is an emoji width in em, one of 21 `SPACINGS` steps (1–1.5, step 0.025, labelled "1".."21"). Widths between two blanks are hit by `blankFiller`, which mixes the two nearest blanks along each row so the n-th blank always ends within ~0.04em of n × width. Default 1.25 ≈ Android's 1.245em. `script.js` `detectSpacing()` measures the device's emoji width. The "fine-tune test" (`calibrationText`) lets users pick a step manually, and it's stored per platform in `state.spacing` as a width. Old saved letters A–H are migrated by `normalizeSpacing`. Apps that draw their own emojis (WhatsApp) can differ from the browser's font, which is what the test is for.
- `LINE_GUARD` (U+2800 braille blank) prefixes every line for WhatsApp/Instagram/Facebook so apps don't trim leading gaps or drop empty lines. The `other` platform has no guard.
- Visible backgrounds (⬜/⬛/custom emoji) pad rows into a rectangle instead.
- `PLATFORMS[*].maxWidth` is the approximate emoji count that fits on a phone line; it drives the too-wide warning and "Make it fit".

When changing copy output or the font, verify the result as pasted plain text and keep the per-platform guards and width limits intact. The tests encode these invariants.

### Source contains invisible characters

`art.js` and the tests include literal VS16 (U+FE0F), ZWJ, U+3000, U+2800 and thin/hair/four-per-em spaces inside string literals (e.g. `SPACINGS`, `normalizeEmoji`). Take care that edits don't strip or normalize them. Prefer `\u{...}` escapes in new code.

### State, storage and design links

- `DEFAULT_STATE` in `script.js` lists every setting. `applySaved()` is the single validator for both localStorage and design links. Links are untrusted input, so it type-checks, size-caps, and only accepts `custom` keys that exist in `GLYPHS`. A new setting must be added to `DEFAULT_STATE` and `applySaved()`, and also to `DESIGN_KEYS` if it describes the art (and so belongs in shared links).
- `STORAGE_KEY` is deliberately still `"emoji-text-maker:v2"` from before the rename. Don't change it, or users lose saved settings.
- Design links are `#d=<url-safe base64 of UTF-8 JSON>`. The hash is removed after loading so later edits aren't overwritten on refresh.

### Font changes

`charKey()` maps input to font keys (uppercase, accents stripped via NFD, VS stripped; unknown → `?`). Tests require every glyph to be exactly 7 rows of equal width, every letter/digit to be unique at each depth, strokes to stay 4-connected at depth 2 and 3, and the letters in `"AHIMOTUVWXY8"` to stay mirror-symmetric.
