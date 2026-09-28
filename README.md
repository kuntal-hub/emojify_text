# Emojify Text ✨

Turn any text into big letters made of emojis, then paste it into WhatsApp, Instagram or Facebook, perfectly lined up.

**Live site:** https://kuntal-hub.github.io/emojify_text/

## Features

- Pick default emojis, or give every character its own emoji(s) and depth (1–3 emoji layers per stroke)
- Rounded, easy-to-read 5×7 pixel font: A–Z, 0–9, common punctuation and ♥
- Side-by-side or stacked layout, with a warning and "Make it fit" when the art is too wide for a phone chat
- Copy formatted for WhatsApp, Instagram or Facebook: gaps sized to match emoji width, protected lines, and spacing auto-detected for your device (with a 30-second fine-tune test)
- Share straight to apps from your phone, download as PNG, or copy a link to your design

## Run locally

It's a static site with no build step. Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
```

## Tests

```sh
node --test tests/art.test.js
```

## Files

| File | What it does |
| --- | --- |
| `index.html`, `style.css` | Page and styling |
| `font.js` | The pixel font (each character as a 7-row grid) |
| `art.js` | Text → emoji grid, platform copy formatting, design links (no DOM, testable in Node) |
| `script.js` | The page's interactive parts |
| `tests/art.test.js` | Unit tests |
