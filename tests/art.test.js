// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../art.js");

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");
const ALL_KEYS = Object.keys(A.GLYPHS);

// Columns occupied by each letter when a single line is laid out horizontally.
function letterColumns(text, depthOf) {
  const spans = [];
  let x = 0;
  let prev = null;
  for (const ch of text) {
    const d = depthOf(ch);
    if (prev) x += Math.max(prev, d);
    const w = A.GLYPHS[ch][0].length * d;
    spans.push([x, x + w]);
    x += w;
    prev = d;
  }
  return spans;
}

function emojisIn(grid, [x0, x1]) {
  const set = new Set();
  for (const row of grid) for (let x = x0; x < x1; x++) if (row[x]) set.add(row[x]);
  return set;
}

function isConnected(mask) {
  const cells = [];
  mask.forEach((row, y) => row.forEach((on, x) => on && cells.push([x, y])));
  if (!cells.length) return true;
  const seen = new Set([cells[0].join()]);
  const stack = [cells[0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (mask[ny] && mask[ny][nx] && !seen.has(nx + "," + ny)) {
        seen.add(nx + "," + ny);
        stack.push([nx, ny]);
      }
    }
  }
  return seen.size === cells.length;
}

// ---------- font ----------

test("font covers A-Z and 0-9 with well-formed 7-row glyphs", () => {
  for (const key of [...LETTERS, ...DIGITS]) assert.ok(A.GLYPHS[key], `missing glyph ${key}`);
  for (const key of ALL_KEYS) {
    const g = A.GLYPHS[key];
    assert.equal(g.length, 7, `${key} should have 7 rows`);
    for (const row of g) {
      assert.equal(row.length, g[0].length, `${key} rows must be the same width`);
      assert.match(row, /^[#.]+$/, `${key} has invalid characters`);
    }
  }
});

test("every letter and digit has a unique shape at every depth", () => {
  for (const depth of [1, 2, 3]) {
    const seen = new Map();
    for (const key of [...LETTERS, ...DIGITS]) {
      const sig = JSON.stringify(A.glyphMask(key, depth));
      assert.ok(!seen.has(sig), `${key} looks identical to ${seen.get(sig)} at depth ${depth}`);
      seen.set(sig, key);
    }
  }
  // O and 0 must differ (0 has a slash)
  assert.notDeepEqual(A.glyphMask("O", 2), A.glyphMask("0", 2));
});

test("depth scales the glyph: 'I' is 5x7, 10x14, 15x21", () => {
  for (const depth of [1, 2, 3]) {
    const m = A.glyphMask("I", depth);
    assert.equal(m.length, 7 * depth);
    assert.equal(m[0].length, 5 * depth);
  }
  // Same shape as the example in the requirements: two full rows, a 2-wide stem, two full rows.
  const i2 = A.glyphMask("I", 2).map((r) => r.map((c) => (c ? "#" : ".")).join(""));
  assert.equal(i2[0], "##########");
  assert.equal(i2[1], "##########");
  for (let y = 2; y < 12; y++) assert.equal(i2[y], "....##....");
  assert.equal(i2[12], "##########");
  assert.equal(i2[13], "##########");
});

test("scaling keeps each character's shape (smoothing only rounds corners)", () => {
  for (const key of ALL_KEYS) {
    const glyph = A.GLYPHS[key];
    for (const d of [2, 3]) {
      const m = A.glyphMask(key, d);
      glyph.forEach((row, y) =>
        [...row].forEach((px, x) => {
          let filled = 0;
          let nonCorner = 0;
          for (let sy = 0; sy < d; sy++)
            for (let sx = 0; sx < d; sx++) {
              const on = m[y * d + sy][x * d + sx];
              filled += on;
              const corner = (sx === 0 || sx === d - 1) && (sy === 0 || sy === d - 1);
              if (on && !corner) nonCorner++;
            }
          if (px === "#") assert.equal(filled, d * d, `${key}@${d}: stroke pixel ${x},${y} must be solid`);
          else {
            assert.equal(nonCorner, 0, `${key}@${d}: blank pixel ${x},${y} filled beyond its corners`);
            assert.ok(filled <= 2, `${key}@${d}: blank pixel ${x},${y} got ${filled} cells`);
          }
        })
      );
    }
  }
});

test("strokes stay connected at depth 2 and 3 (no broken diagonals)", () => {
  for (const key of [...LETTERS, ...DIGITS, "♥"]) {
    for (const d of [2, 3]) assert.ok(isConnected(A.glyphMask(key, d)), `${key} is broken at depth ${d}`);
  }
});

test("symmetric letters stay symmetric at every depth", () => {
  for (const key of "AHIMOTUVWXY8".split("")) {
    for (const d of [1, 2, 3]) {
      const m = A.glyphMask(key, d);
      for (const row of m) assert.deepEqual(row, [...row].reverse(), `${key}@${d} is not symmetric`);
    }
  }
});

test("curves are rounded: O at depth 2 has diagonal corner cells", () => {
  const o = A.glyphMask("O", 2).map((r) => r.map((c) => (c ? "#" : ".")).join(""));
  assert.equal(o[0], "..######..");
  assert.equal(o[1], ".########.");
  assert.equal(o[2], "###....###");
  assert.equal(o[3], "##......##");
});

test("depth is clamped to 1-3", () => {
  assert.equal(A.clampDepth(0), 1);
  assert.equal(A.clampDepth(-4), 1);
  assert.equal(A.clampDepth(7), 3);
  assert.equal(A.clampDepth("2"), 2);
  assert.equal(A.clampDepth("abc"), 2);
  assert.equal(A.clampDepth(null, 3), 3);
  assert.equal(A.clampDepth(undefined, 1), 1);
  assert.equal(A.glyphMask("A", 99).length, 21);
});

// ---------- characters & emoji parsing ----------

test("charKey is case-insensitive, strips accents and maps unknowns to ?", () => {
  assert.equal(A.charKey("k"), "K");
  assert.equal(A.charKey("é"), "E");
  assert.equal(A.charKey("Ñ"), "N");
  assert.equal(A.charKey("❤️"), "❤");
  assert.equal(A.charKey("♥"), "♥");
  assert.equal(A.charKey("€"), "?");
  assert.equal(A.charKey("😀"), "?");
  assert.equal(A.charKey(" "), " ");
  assert.equal(A.hasUnsupported("HI€"), true);
  assert.equal(A.hasUnsupported("HI?"), false);
});

test("uniqueKeys lists each character once, in order, without spaces", () => {
  assert.deepEqual(A.uniqueKeys("Hello World"), ["H", "E", "L", "O", "W", "R", "D"]);
  assert.deepEqual(A.uniqueKeys("kuntal KUNTAL"), ["K", "U", "N", "T", "A", "L"]);
  assert.deepEqual(A.uniqueKeys("   "), []);
});

function checkParsing() {
  assert.deepEqual(A.parseEmojis("🔥🌟💧"), ["🔥", "🌟", "💧"]);
  assert.deepEqual(A.parseEmojis(" 🔥, 🌟 "), ["🔥", "🌟"]);
  assert.deepEqual(A.parseEmojis("👨‍👩‍👧"), ["👨‍👩‍👧"]);
  assert.deepEqual(A.parseEmojis("👍🏽👍"), ["👍🏽", "👍"]);
  assert.deepEqual(A.parseEmojis("🇮🇳🇺🇸"), ["🇮🇳", "🇺🇸"]);
  assert.deepEqual(A.parseEmojis("❤"), ["❤️"], "text-style heart gets emoji style");
  assert.deepEqual(A.parseEmojis("❤️"), ["❤️"]);
  assert.deepEqual(A.parseEmojis("☀✈"), ["☀️", "✈️"]);
  assert.deepEqual(A.parseEmojis(""), []);
  assert.deepEqual(A.parseEmojis(null), []);
}

test("parseEmojis keeps multi-part emojis together", checkParsing);

test("parseEmojis works without Intl.Segmenter (older browsers)", () => {
  const original = Intl.Segmenter;
  Intl.Segmenter = undefined;
  try {
    checkParsing();
  } finally {
    Intl.Segmenter = original;
  }
});

// ---------- grid building ----------

test("KUNTAL with one emoji uses only that emoji", () => {
  const grid = A.buildGrid("KUNTAL", { emojis: ["🌟"] });
  const used = new Set(grid.flat().filter(Boolean));
  assert.deepEqual([...used], ["🌟"]);
  assert.equal(grid.length, 14);
});

test("each character can have its own emoji", () => {
  const custom = {
    K: { emojis: ["🌟"] },
    U: { emojis: ["🔥"] },
    N: { emojis: ["💧"] },
    T: { emojis: ["🍀"] },
    A: { emojis: ["🌈"] },
    L: { emojis: ["⭐"] },
  };
  const grid = A.buildGrid("KUNTAL", { emojis: ["😘"], custom });
  const spans = letterColumns("KUNTAL", () => 2);
  [..."KUNTAL"].forEach((ch, i) => {
    assert.deepEqual([...emojisIn(grid, spans[i])], custom[ch].emojis, `${ch} uses the wrong emoji`);
  });
});

test("custom settings apply to lowercase letters too", () => {
  const grid = A.buildGrid("k", { emojis: ["😘"], custom: { K: { emojis: ["🌟"] } } });
  assert.deepEqual([...new Set(grid.flat().filter(Boolean))], ["🌟"]);
});

test("a character can use several emojis, and only those", () => {
  const custom = { K: { emojis: ["🔥", "🌟"] }, U: { emojis: ["🍀", "💧", "🌟"] } };
  for (const pattern of A.PATTERNS) {
    const grid = A.buildGrid("KU", { emojis: ["😘"], custom, pattern, seed: 7 });
    const [k, u] = letterColumns("KU", () => 2);
    assert.deepEqual([...emojisIn(grid, k)].sort(), ["🌟", "🔥"], `K with ${pattern}`);
    assert.deepEqual([...emojisIn(grid, u)].sort(), ["🌟", "💧", "🍀"].sort(), `U with ${pattern}`);
  }
});

test("patterns place emojis predictably", () => {
  const custom = { H: { emojis: ["🔥", "🌟"] } };
  const rows = A.buildGrid("H", { custom, pattern: "rows" });
  rows.forEach((row, y) => row.filter(Boolean).forEach((e) => assert.equal(e, y % 2 ? "🌟" : "🔥")));
  const cols = A.buildGrid("H", { custom, pattern: "columns" });
  cols.forEach((row) => row.forEach((e, x) => e && assert.equal(e, x % 2 ? "🌟" : "🔥")));
  const diag = A.buildGrid("H", { custom, pattern: "diagonal" });
  diag.forEach((row, y) => row.forEach((e, x) => e && assert.equal(e, (x + y) % 2 ? "🌟" : "🔥")));
});

test("random pattern is stable for a seed and changes with the seed", () => {
  const opts = { emojis: ["🔥", "🌟", "💧"], mode: "mix", pattern: "random" };
  const a = A.buildGrid("HELLO", { ...opts, seed: 1 });
  const b = A.buildGrid("HELLO", { ...opts, seed: 1 });
  const c = A.buildGrid("HELLO", { ...opts, seed: 2 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  // shape is the same regardless of emoji placement
  assert.deepEqual(a.map((r) => r.map(Boolean)), c.map((r) => r.map(Boolean)));
});

test("mode 'turns' gives each letter the next default emoji; 'mix' uses all in every letter", () => {
  const emojis = ["😘", "🤣"];
  const spans = letterColumns("ABC", () => 2);
  const turns = A.buildGrid("ABC", { emojis, mode: "turns" });
  assert.deepEqual([...emojisIn(turns, spans[0])], ["😘"]);
  assert.deepEqual([...emojisIn(turns, spans[1])], ["🤣"]);
  assert.deepEqual([...emojisIn(turns, spans[2])], ["😘"]);
  const mix = A.buildGrid("ABC", { emojis, mode: "mix" });
  for (const span of spans) assert.equal(emojisIn(mix, span).size, 2);
});

test("global depth changes stroke thickness and size", () => {
  for (const depth of [1, 2, 3]) {
    const grid = A.buildGrid("L", { depth });
    assert.equal(grid.length, 7 * depth);
    assert.equal(grid[grid.length - 1].filter(Boolean).length, 5 * depth, "bottom bar width");
    assert.equal(grid[0].filter(Boolean).length, depth, "stem thickness");
  }
});

test("per-character depth overrides the global depth; letters share a baseline", () => {
  const grid = A.buildGrid("KU", { depth: 1, custom: { K: { depth: 3 } } });
  assert.equal(grid.length, 21);
  const [k, u] = letterColumns("KU", (ch) => (ch === "K" ? 3 : 1));
  const rowsWith = (span) =>
    grid.map((row, y) => (row.slice(span[0], span[1]).some(Boolean) ? y : -1)).filter((y) => y >= 0);
  const kRows = rowsWith(k);
  const uRows = rowsWith(u);
  assert.equal(kRows[0], 0);
  assert.equal(kRows.at(-1), 20);
  assert.equal(uRows[0], 14, "U (depth 1) sits on the baseline");
  assert.equal(uRows.at(-1), 20);
  // K is 3 emojis thick: its first column is filled on all 21 rows
  assert.ok(grid.every((row) => row[0] && row[1] && row[2]));
});

test("a null per-character depth falls back to the global depth", () => {
  const a = A.buildGrid("AB", { depth: 3, custom: { A: { depth: null, emojis: [] } } });
  const b = A.buildGrid("AB", { depth: 3 });
  assert.deepEqual(a, b);
});

test("spaces separate words", () => {
  const grid = A.buildGrid("A B", { depth: 2 });
  // A (10) + space (3*2) + B (10), no extra letter gaps next to the space
  assert.equal(Math.max(...grid.map((r) => r.length)), 26);
  assert.ok(grid.every((row) => row.slice(10, 16).every((c) => c === null)));
});

test("new lines stack rows of letters", () => {
  const grid = A.buildGrid("HI\nYOU", { depth: 2 });
  assert.equal(grid.length, 14 + 4 + 14);
  assert.ok(grid.slice(14, 18).every((row) => row.every((c) => !c)));
});

test("vertical layout stacks letters and centres narrow ones", () => {
  const grid = A.buildGrid("AB!", { depth: 2, layout: "vertical" });
  assert.equal(grid.length, 14 * 3 + 2 * 2);
  const bang = grid.slice(-14);
  const cols = new Set();
  bang.forEach((row) => row.forEach((c, x) => c && cols.add(x)));
  assert.deepEqual([...cols].sort(), [4, 5], "the ! is centred under 10-wide letters");
});

test("empty or whitespace-only text gives an empty grid", () => {
  assert.deepEqual(A.buildGrid("", {}), []);
  assert.deepEqual(A.trimGrid(A.buildGrid("   \n  ", {})), []);
  assert.deepEqual(A.trimGrid(A.buildGrid("   ", { layout: "vertical" })), []);
});

test("unsupported characters render as ?", () => {
  assert.deepEqual(A.buildGrid("€", {}), A.buildGrid("?", {}));
});

test("missing or empty emoji lists fall back safely", () => {
  const grid = A.buildGrid("A", { emojis: [], custom: { A: { emojis: [] } } });
  assert.ok(grid.flat().filter(Boolean).every((e) => e === "😘"));
});

// ---------- text output ----------

test("gridToText matches the requirement's 'I' example", () => {
  const text = A.gridToText(A.buildGrid("I", { emojis: ["😘"] }), "  ");
  const lines = text.split("\n");
  assert.equal(lines.length, 14);
  assert.equal(lines[0], "😘".repeat(10));
  assert.equal(lines[5], "  ".repeat(4) + "😘😘", "trailing blanks are trimmed");
  assert.equal(lines[13], "😘".repeat(10));
});

test("gridToText pads rows when asked (for visible blanks like ⬜)", () => {
  const lines = A.gridToText(A.buildGrid("L", { emojis: ["🔥"], depth: 1 }), "⬜", { pad: true }).split("\n");
  assert.equal(lines[0], "🔥⬜⬜⬜⬜");
  assert.ok(lines.every((l) => [...A.splitGraphemes(l)].length === 5));
});

// ---------- platform copy ----------

const G = A.LINE_GUARD;
const splitCells = (line, blank) => line.slice(G.length).split(blank);

test("platform copy: every line starts with the guard so apps can't trim leading gaps", () => {
  const grid = A.trimGrid(A.buildGrid("OA", { emojis: ["😘"] }));
  for (const platform of ["whatsapp", "instagram", "facebook"]) {
    const lines = A.formatForPlatform(grid, { platform }).split("\n");
    assert.equal(lines.length, grid.length);
    for (const line of lines) {
      assert.ok(line.startsWith(G), `${platform}: line must start with the guard`);
      assert.ok(!/^\s/u.test(line), `${platform}: no leading whitespace`);
      assert.ok(!/\s$/u.test(line), `${platform}: no trailing whitespace`);
    }
  }
});

test("platform copy: empty rows between lines keep the guard (Instagram deletes empty lines)", () => {
  const grid = A.trimGrid(A.buildGrid("A\nB", { emojis: ["😘"] }));
  const lines = A.formatForPlatform(grid, { platform: "instagram" }).split("\n");
  assert.equal(lines.length, 14 + 4 + 14);
  for (const line of lines.slice(14, 18)) assert.equal(line, G);
});

test("platform copy: blanks use the chosen spacing and keep every row's cell count", () => {
  const grid = A.trimGrid(A.buildGrid("I", { emojis: ["😘"] }));
  for (const s of A.SPACINGS) {
    const lines = A.formatForPlatform(grid, { platform: "whatsapp", spacing: s.id }).split("\n");
    assert.equal(lines[5], G + s.chars.repeat(4) + "😘😘", `spacing ${s.id}`);
  }
  // default spacing is D (U+3000 + four-per-em space = 1.25em, Android's emoji width)
  const def = A.formatForPlatform(grid, { platform: "whatsapp" }).split("\n")[5];
  assert.equal(def, G + "　 ".repeat(4) + "😘😘");
  // unknown spacing ids fall back to the default
  assert.equal(A.formatForPlatform(grid, { platform: "whatsapp", spacing: "Z" }).split("\n")[5], def);
});

test("spacing options get wider in order and D matches Android's emoji width", () => {
  const widths = A.SPACINGS.map((s) => s.width);
  assert.deepEqual([...widths].sort((a, b) => a - b), widths);
  assert.equal(new Set(A.SPACINGS.map((s) => s.id)).size, A.SPACINGS.length);
  const d = A.SPACINGS.find((s) => s.id === A.DEFAULT_SPACING);
  assert.ok(Math.abs(d.width - 1.245) < 0.01);
  for (const s of A.SPACINGS) assert.match(s.chars, /^[　 - ]+$/u, "only real, fixed-width spaces");
});

test("platform copy with visible backgrounds pads a rectangle and needs no guard", () => {
  const grid = A.trimGrid(A.buildGrid("L", { emojis: ["🔥"], depth: 1 }));
  const white = A.formatForPlatform(grid, { platform: "whatsapp", background: "white" }).split("\n");
  assert.equal(white[0], "🔥" + "⬜️".repeat(4));
  assert.ok(white.every((l) => A.splitGraphemes(l).length === 5));
  const custom = A.formatForPlatform(grid, { platform: "instagram", background: "custom", customBlank: "🖤" });
  assert.equal(custom.split("\n")[0], "🔥🖤🖤🖤🖤");
  const fallback = A.formatForPlatform(grid, { background: "custom", customBlank: "" });
  assert.equal(fallback.split("\n")[0], "🔥" + "⬜️".repeat(4));
});

test("'other' platform has no guard", () => {
  const grid = A.trimGrid(A.buildGrid("I", { emojis: ["😘"] }));
  const lines = A.formatForPlatform(grid, { platform: "other" }).split("\n");
  assert.equal(lines[0], "😘".repeat(10));
});

test("calibration text: one reference row plus one line per spacing option", () => {
  const lines = A.calibrationText("whatsapp").split("\n");
  assert.equal(lines.length, 1 + A.SPACINGS.length);
  assert.equal(lines[0], G + "🟥".repeat(9));
  A.SPACINGS.forEach((s, i) => assert.equal(lines[i + 1], G + s.chars.repeat(8) + "🟥 " + s.id));
});

test("platform width limits: stacked depth 2 fits WhatsApp, side-by-side words don't", () => {
  const stacked = A.gridStats(A.trimGrid(A.buildGrid("KUNTAL", { layout: "vertical", depth: 2 })));
  const wide = A.gridStats(A.trimGrid(A.buildGrid("KUNTAL", { depth: 2 })));
  assert.ok(stacked.width <= A.PLATFORMS.whatsapp.maxWidth);
  assert.ok(wide.width > A.PLATFORMS.whatsapp.maxWidth);
  // every letter and digit fits stacked at depth 2 on every platform
  for (const key of [...LETTERS, ...DIGITS]) {
    for (const p of ["whatsapp", "instagram", "facebook"]) {
      assert.ok(A.glyphMask(key, 2)[0].length <= A.PLATFORMS[p].maxWidth, `${key} on ${p}`);
    }
  }
});

// ---------- design links ----------

test("design links round-trip text, emojis and per-character settings", () => {
  const design = {
    text: "Kuntal ♥ é!",
    emojis: "👨‍👩‍👧🇮🇳❤️👍🏽",
    depth: 3,
    custom: { K: { emojis: "🔥🌟", depth: 2 }, "?": { emojis: "", depth: null } },
  };
  const code = A.encodeDesign(design);
  assert.match(code, /^[A-Za-z0-9_-]+$/, "URL-safe, no padding");
  assert.deepEqual(A.decodeDesign(code), design);
});

test("broken or hostile design links decode to null", () => {
  for (const bad of ["", "%%%", "a", "bm90IGpzb24", A.encodeDesign([1, 2]), A.encodeDesign("str"), null, undefined]) {
    assert.equal(A.decodeDesign(bad), null, `input ${JSON.stringify(bad)}`);
  }
});

test("text output has one line per grid row and no empty edge rows", () => {
  const grid = A.trimGrid(A.buildGrid("  HI  \n\n  ", {}));
  const text = A.gridToText(grid, "　");
  assert.equal(text.split("\n").length, grid.length);
  assert.ok(!text.startsWith("\n") && !text.endsWith("\n"));
});
