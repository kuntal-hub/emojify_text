// Pure text -> emoji-art logic. No DOM access, so it runs in the browser and in Node tests.
const EmojiArt = (() => {
  const GLYPHS = typeof FONT !== "undefined" ? FONT : require("./font.js").FONT;

  const MIN_DEPTH = 1;
  const MAX_DEPTH = 3;
  const DEFAULT_DEPTH = 2;
  const PATTERNS = ["diagonal", "rows", "columns", "random"];

  function clampDepth(value, fallback = DEFAULT_DEPTH) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || value === null || value === "") return fallback;
    return Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, n));
  }

  // Fallback grapheme splitter for browsers without Intl.Segmenter: keeps flags,
  // skin tones, keycaps and ZWJ sequences (👨‍👩‍👧) together.
  const GRAPHEME_RE =
    /\p{RI}\p{RI}|\p{Extended_Pictographic}(?:\p{EMod}|️⃣?|[\u{E0020}-\u{E007E}]+\u{E007F})?(?:‍\p{Extended_Pictographic}(?:\p{EMod}|️)?)*|[#*0-9]️?⃣|\P{M}\p{M}*|./gsu;

  function splitGraphemes(str) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(str), (s) => s.segment);
    }
    return str.match(GRAPHEME_RE) || [];
  }

  // Symbols like ❤ ☀ ✈ default to a narrow text look; VS16 forces the colourful emoji look
  // so every cell has the same width.
  function normalizeEmoji(g) {
    const cps = Array.from(g);
    if (
      cps.length === 1 &&
      /\p{Extended_Pictographic}/u.test(g) &&
      !/\p{Emoji_Presentation}/u.test(g)
    ) {
      return g + "️";
    }
    return g;
  }

  // "🔥 🌟,💧" -> ["🔥", "🌟", "💧"]
  function parseEmojis(str) {
    return splitGraphemes(String(str || ""))
      .filter((g) => g.trim() !== "" && g !== ",")
      .map(normalizeEmoji);
  }

  // Maps a typed character to its font key: "k" -> "K", "é" -> "E", "❤️" -> "❤".
  // Characters the font doesn't know become "?".
  function charKey(ch) {
    if (/^\s+$/.test(ch)) return " ";
    const base = ch.replace(/[︎️]/g, "");
    if (GLYPHS[base]) return base;
    const upper = base.toUpperCase();
    if (GLYPHS[upper]) return upper;
    const stripped = upper.normalize("NFD").replace(/\p{M}/gu, "");
    if (GLYPHS[stripped]) return stripped;
    return "?";
  }

  // Unique non-space characters of the text, in order of first appearance.
  function uniqueKeys(text) {
    const seen = new Set();
    for (const ch of splitGraphemes(text)) {
      const key = charKey(ch);
      if (key !== " ") seen.add(key);
    }
    return [...seen];
  }

  function hasUnsupported(text) {
    return splitGraphemes(text).some((ch) => charKey(ch) === "?" && ch !== "?");
  }

  // Scales a glyph by `depth` and fills the corner of each blank pixel that sits between
  // two diagonal neighbours, so curves and slanted strokes look round instead of stepped.
  const cache = new Map();
  function glyphMask(key, depth) {
    depth = clampDepth(depth);
    const id = key + "|" + depth;
    if (cache.has(id)) return cache.get(id);

    const glyph = GLYPHS[key] || GLYPHS["?"];
    const h = glyph.length;
    const w = glyph[0].length;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && glyph[y][x] === "#";

    const mask = Array.from({ length: h * depth }, () => new Array(w * depth).fill(false));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (on(x, y)) {
          for (let sy = 0; sy < depth; sy++)
            for (let sx = 0; sx < depth; sx++) mask[y * depth + sy][x * depth + sx] = true;
          continue;
        }
        if (depth < 2) continue;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (on(x + dx, y) && on(x, y + dy) && !on(x + dx, y + dy)) {
            const cx = dx < 0 ? x * depth : x * depth + depth - 1;
            const cy = dy < 0 ? y * depth : y * depth + depth - 1;
            mask[cy][cx] = true;
          }
        }
      }
    }
    cache.set(id, mask);
    return mask;
  }

  // Small deterministic hash so "random" patterns don't reshuffle on every keystroke.
  function hash(a, b, c, d) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (b + 0x632be5ab), 0xc2b2ae35);
    h = Math.imul(h ^ (c + 0x27d4eb2f), 0x165667b1);
    h = Math.imul(h ^ (d + 0x5bd1e995), 0x85ebca6b);
    return (h ^ (h >>> 15)) >>> 0;
  }

  function pickEmoji(list, pattern, x, y, letterIndex, seed) {
    if (list.length === 1) return list[0];
    let i;
    switch (pattern) {
      case "rows":
        i = y;
        break;
      case "columns":
        i = x;
        break;
      case "random":
        i = hash(x, y, letterIndex, seed);
        break;
      default:
        i = x + y;
    }
    return list[i % list.length];
  }

  // options:
  //   emojis:   default emoji list, e.g. ["😘", "🤣"]
  //   mode:     "turns" (each letter takes the next default emoji) | "mix" (every letter uses all)
  //   pattern:  how a letter with several emojis mixes them: diagonal | rows | columns | random
  //   depth:    default stroke thickness, 1-3
  //   layout:   "horizontal" | "vertical"
  //   custom:   { K: { emojis: ["🔥", "🌟"], depth: 3 }, ... } per-character overrides
  //   seed:     number for the random pattern
  // Returns a 2D array of rows; each cell is an emoji string or null (empty).
  function buildGrid(text, options = {}) {
    const defaults = options.emojis && options.emojis.length ? options.emojis : ["😘"];
    const mode = options.mode === "mix" ? "mix" : "turns";
    const pattern = PATTERNS.includes(options.pattern) ? options.pattern : "diagonal";
    const baseDepth = clampDepth(options.depth);
    const custom = options.custom || {};
    const seed = options.seed | 0;

    let letterIndex = 0;

    const makeBlock = (key) => {
      const conf = custom[key] || {};
      const depth = clampDepth(conf.depth, baseDepth);
      if (key === " ") return { space: true, depth, width: 0, height: 0, cells: [] };

      const own = conf.emojis && conf.emojis.length ? conf.emojis : null;
      const list = own || (mode === "turns" ? [defaults[letterIndex % defaults.length]] : defaults);
      const index = letterIndex++;
      const mask = glyphMask(key, depth);
      const cells = mask.map((row, y) =>
        row.map((filled, x) => (filled ? pickEmoji(list, pattern, x, y, index, seed) : null))
      );
      return { space: false, depth, width: mask[0].length, height: mask.length, cells };
    };

    // Spaces take their size from the neighbouring letters.
    const sizeSpaces = (blocks) => {
      blocks.forEach((b, i) => {
        if (!b.space) return;
        const prev = blocks.slice(0, i).reverse().find((o) => !o.space);
        const next = blocks.slice(i + 1).find((o) => !o.space);
        b.depth = Math.max(prev ? prev.depth : 0, next ? next.depth : 0) || baseDepth;
      });
    };

    const grid = [];
    const pushBlank = (count) => {
      for (let i = 0; i < count; i++) grid.push([]);
    };

    if (options.layout === "vertical") {
      const blocks = splitGraphemes(text.replace(/\s+/g, " ").trim()).map((ch) =>
        makeBlock(charKey(ch))
      );
      sizeSpaces(blocks);
      const width = Math.max(0, ...blocks.map((b) => b.width));
      blocks.forEach((b, i) => {
        if (b.space) {
          pushBlank(b.depth * 2);
          return;
        }
        const prev = blocks[i - 1];
        if (prev && !prev.space) pushBlank(Math.max(prev.depth, b.depth));
        const offset = Math.floor((width - b.width) / 2); // centre narrow characters
        for (const row of b.cells) grid.push(new Array(offset).fill(null).concat(row));
      });
      return grid;
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "");
    let prevLineDepth = 0;
    for (const line of lines) {
      const blocks = splitGraphemes(line).map((ch) => makeBlock(charKey(ch)));
      sizeSpaces(blocks);
      const letters = blocks.filter((b) => !b.space);
      if (!letters.length) continue;
      const height = Math.max(...letters.map((b) => b.height));
      const lineDepth = Math.max(...letters.map((b) => b.depth));
      const rows = Array.from({ length: height }, () => []);

      blocks.forEach((b, i) => {
        const prev = blocks[i - 1];
        if (b.space) {
          for (const row of rows) row.push(...new Array(b.depth * 3).fill(null));
          return;
        }
        if (prev && !prev.space) {
          const gap = Math.max(prev.depth, b.depth);
          for (const row of rows) row.push(...new Array(gap).fill(null));
        }
        const top = height - b.height; // letters share a baseline, like normal text
        rows.forEach((row, y) => {
          const src = b.cells[y - top];
          row.push(...(src || new Array(b.width).fill(null)));
        });
      });

      if (grid.length) pushBlank(Math.max(prevLineDepth, lineDepth) * 2);
      grid.push(...rows);
      prevLineDepth = lineDepth;
    }
    return grid;
  }

  // Trims empty cells at the end of rows and removes fully empty rows at the edges.
  function trimGrid(grid) {
    const rows = grid.map((row) => {
      let end = row.length;
      while (end > 0 && !row[end - 1]) end--;
      return row.slice(0, end);
    });
    while (rows.length && !rows[0].length) rows.shift();
    while (rows.length && !rows[rows.length - 1].length) rows.pop();
    return rows;
  }

  // pad: fill every row to the full width (for visible blanks like ⬜, so the art stays a
  // clean rectangle). Without it, trailing blanks are dropped.
  function gridToText(grid, blank, { pad = false } = {}) {
    const rows = trimGrid(grid);
    const width = pad ? Math.max(0, ...rows.map((r) => r.length)) : 0;
    return rows
      .map((row) => {
        const cells = pad ? row.concat(new Array(width - row.length).fill(null)) : row;
        return cells.map((cell) => cell || blank).join("");
      })
      .join("\n");
  }

  // ---------- copying to social platforms ----------
  //
  // Emojis are wider than any invisible character: 1.245em with Android's emoji font and
  // 1.37em on Windows, while the ideographic space (U+3000) is exactly 1em. Pasted as plain
  // text, a row with gaps therefore drifts left. A blank is U+3000 padded with a fixed-width
  // Unicode space, which gives only these exact widths:
  const BLANKS = [
    { width: 1, chars: "\u3000" },
    { width: 7 / 6, chars: "\u3000\u2006" }, // + six-per-em space
    { width: 1.25, chars: "\u3000\u2005" }, // + four-per-em space
    { width: 4 / 3, chars: "\u3000\u2004" }, // + three-per-em space
    { width: 1.5, chars: "\u3000\u2002" }, // + en space
  ];

  // Emoji widths in between (WhatsApp's own emojis, for one) are matched by mixing the two
  // nearest blanks along the row, so the n-th blank of every row ends within ~0.04em of
  // n × width and gaps never add up to a visible drift.
  const MIN_SPACING = 1;
  const MAX_SPACING = 1.5;
  const SPACING_STEP = 0.025;
  // Steps offered by the fine-tune test, labelled "1".."21".
  const SPACINGS = Array.from({ length: Math.round((MAX_SPACING - MIN_SPACING) / SPACING_STEP) + 1 }, (_, i) => ({
    id: String(i + 1),
    width: Math.round((MIN_SPACING + i * SPACING_STEP) * 1000) / 1000,
  }));
  const DEFAULT_SPACING = 1.25; // matches Android's emoji width (1.245em)

  // Letters from the earlier 8-step test, so spacing saved on a device keeps working.
  const LEGACY_SPACINGS = { A: 1, B: 1.167, C: 1.2, D: 1.25, E: 1.333, F: 1.375, G: 1.417, H: 1.5 };

  function spacingStep(width) {
    const i = Math.round((Math.min(MAX_SPACING, Math.max(MIN_SPACING, width)) - MIN_SPACING) / SPACING_STEP);
    return SPACINGS[i];
  }

  // A width (number) or legacy letter -> the nearest step's width; null if not a spacing.
  function normalizeSpacing(value) {
    const w = typeof value === "string" && Object.hasOwn(LEGACY_SPACINGS, value) ? LEGACY_SPACINGS[value] : value;
    if (typeof w !== "number" || !Number.isFinite(w)) return null;
    return spacingStep(w).width;
  }

  // Returns a function giving the characters for the next blank of one row.
  function blankFiller(width) {
    const w = normalizeSpacing(width) ?? DEFAULT_SPACING;
    const hi = BLANKS.find((b) => b.width >= w - 1e-9);
    const lo = [...BLANKS].reverse().find((b) => b.width <= w + 1e-9);
    let used = 0;
    let count = 0;
    return () => {
      count++;
      const target = count * w;
      const b = Math.abs(used + hi.width - target) < Math.abs(used + lo.width - target) ? hi : lo;
      used += b.width;
      return b.chars;
    };
  }

  // Braille blank: invisible but not whitespace, so apps can't trim it. Starting every
  // line with it stops WhatsApp/Instagram/Facebook from eating leading gaps or empty lines.
  const LINE_GUARD = "⠀";

  // maxWidth: roughly how many emojis fit on one line in the app on a phone.
  const PLATFORMS = {
    whatsapp: { name: "WhatsApp", guard: true, maxWidth: 13 },
    instagram: { name: "Instagram", guard: true, maxWidth: 16 },
    facebook: { name: "Facebook", guard: true, maxWidth: 16 },
    other: { name: "other apps", guard: false, maxWidth: null },
  };

  const SQUARES = { white: "⬜️", black: "⬛️" };

  // options: platform (key of PLATFORMS), background ("invisible" | "white" | "black" | "custom"),
  // customBlank (emoji string), spacing (emoji width in em, see SPACINGS)
  function formatForPlatform(grid, options = {}) {
    const platform = PLATFORMS[options.platform] || PLATFORMS.other;
    const background = options.background || "invisible";

    if (background !== "invisible") {
      // Every cell is an emoji, so rows line up in every app; pad rows into a rectangle.
      const blank =
        background === "custom"
          ? parseEmojis(options.customBlank)[0] || SQUARES.white
          : SQUARES[background] || SQUARES.white;
      return gridToText(grid, blank, { pad: true });
    }

    const guard = platform.guard ? LINE_GUARD : "";
    return trimGrid(grid)
      .map((row) => {
        const blank = blankFiller(options.spacing);
        return guard + row.map((cell) => cell || blank()).join("");
      })
      .join("\n");
  }

  // Eight blanks at the given spacing, as used by the fine-tune test.
  function testGap(width) {
    const blank = blankFiller(width);
    return Array.from({ length: 8 }, blank).join("");
  }

  // A test message: the 🟥 on the line whose spacing matches the device's emoji width sits
  // exactly under the last 🟥 of the top row.
  function calibrationText(platform) {
    const guard = (PLATFORMS[platform] || PLATFORMS.other).guard ? LINE_GUARD : "";
    const lines = [guard + "🟥".repeat(9)];
    for (const s of SPACINGS) lines.push(guard + testGap(s.width) + "🟥 " + s.id);
    return lines.join("\n");
  }

  // ---------- design links ----------
  // A design (plain object) <-> URL-safe base64 of its UTF-8 JSON, so emojis survive.

  function encodeDesign(design) {
    const bytes = new TextEncoder().encode(JSON.stringify(design));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Returns the design object, or null for anything that isn't a valid link payload.
  function decodeDesign(str) {
    try {
      const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
      const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  }

  function gridStats(grid) {
    let emojis = 0;
    let width = 0;
    for (const row of grid) {
      width = Math.max(width, row.length);
      for (const cell of row) if (cell) emojis++;
    }
    return { emojis, width, height: grid.length };
  }

  return {
    MIN_DEPTH,
    MAX_DEPTH,
    DEFAULT_DEPTH,
    PATTERNS,
    GLYPHS,
    clampDepth,
    splitGraphemes,
    normalizeEmoji,
    parseEmojis,
    charKey,
    uniqueKeys,
    hasUnsupported,
    glyphMask,
    buildGrid,
    trimGrid,
    gridToText,
    gridStats,
    BLANKS,
    SPACINGS,
    DEFAULT_SPACING,
    normalizeSpacing,
    spacingStep,
    blankFiller,
    testGap,
    LINE_GUARD,
    PLATFORMS,
    formatForPlatform,
    calibrationText,
    encodeDesign,
    decodeDesign,
  };
})();

if (typeof module !== "undefined") module.exports = EmojiArt;
