(() => {
  const STORAGE_KEY = "emoji-text-maker:v2"; // pre-rename key, kept so saved settings survive
  const MAX_TEXT = 60;

  const PRESETS = [
    { name: "Mix", emojis: "😘🤣😍🔥🥳" },
    { name: "Kisses", emojis: "😘" },
    { name: "Stars", emojis: "🌟" },
    { name: "Laughs", emojis: "🤣😂😆" },
    { name: "Hearts", emojis: "❤️🧡💛💚💙💜" },
    { name: "Party", emojis: "🥳🎉🎊" },
    { name: "Fire", emojis: "🔥" },
    { name: "Nature", emojis: "🌟🔥💧🍀🌈⭐" },
    { name: "Food", emojis: "🍕🍔🍩🍓" },
  ];

  // Kept to emojis that render on Windows 10+, macOS, Android and iOS.
  const PICKER_GROUPS = [
    { name: "Smileys", emojis: "😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😗😋😛😜🤪😎🤓🥳😏😢😭😤😡🤯😱🤗🤔🤫😴🤠😈👻💀👽🤖💩" },
    { name: "Hearts", emojis: "❤️🧡💛💚💙💜🤎🖤🤍💖💗💓💞💕💘💝❣️💔" },
    { name: "Hands & people", emojis: "👍👎👏🙌👐🤝🙏✌️🤞🤟🤘👌👈👉👆👇☝️✋👋💪👀👑💃🕺" },
    { name: "Nature", emojis: "🌟⭐✨💫🌈☀️🌙⚡🔥💧🌊❄️☁️🌸🌺🌻🌹🌷🍀🌿🌵🌴🍁🍄🐶🐱🐼🦊🐸🐵🦄🐝🦋🐢🐬🐳" },
    { name: "Food", emojis: "🍎🍓🍒🍑🍍🥭🍉🍇🍋🍌🥑🍕🍔🍟🌭🍿🍩🍪🎂🧁🍫🍭🍬🍦☕🍺🥂" },
    { name: "Objects & symbols", emojis: "🎉🎊🎈🎁🏆🥇⚽🏀🎮🎧🎵🎶💎💰💯✅❌⭕🔴🟠🟡🟢🔵🟣🟤⚫⚪🟥🟧🟨🟩🟦🟪🟫⬛⬜🔶🔷💥💢💤🚀" },
  ];

  const IDEAS = ["HELLO", "I ♥ U", "HBD", "LOVE", "LOL", "OMG", "GM", "GN", "WOW", "THANKS", "MISS U", "YES!"];
  const MAX_RECENT = 16;

  // Everything that describes the art itself; these go into design links.
  const DESIGN_KEYS = ["text", "emojis", "mode", "depth", "pattern", "seed", "layout", "background", "customBlank", "custom"];

  const BACKGROUNDS = ["invisible", "white", "black", "custom"];
  const SQUARE_BLANKS = { white: "⬜", black: "⬛" };

  const DEFAULT_STATE = {
    text: "HELLO",
    emojis: "😘🤣😍🔥🥳",
    mode: "turns",
    depth: 2,
    pattern: "diagonal",
    seed: 1,
    layout: "horizontal",
    platform: "whatsapp",
    background: "invisible",
    customBlank: "🤍",
    spacing: {}, // platform -> emoji width (em) picked with the fine-tune test
    zoom: 18,
    fit: true,
    custom: {}, // key -> { emojis: "🔥🌟", depth: 1-3 | null }
    recent: [], // emojis picked recently in the picker, newest first
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    text: $("text"),
    counter: $("counter"),
    ideas: $("ideas"),
    surprise: $("surprise"),
    unsupported: $("unsupported"),
    emojis: $("emojis"),
    presets: $("presets"),
    pattern: $("pattern"),
    shuffle: $("shuffle"),
    charList: $("char-list"),
    resetAll: $("reset-all"),
    background: $("background"),
    customBlank: $("custom-blank"),
    fitWarning: $("fit-warning"),
    fitWarningText: $("fit-warning-text"),
    makeFit: $("make-fit"),
    shareHint: $("share-hint"),
    copyTest: $("copy-test"),
    spacing: $("spacing"),
    spacingStatus: $("spacing-status"),
    spacingReset: $("spacing-reset"),
    tune: $("tune"),
    zoom: $("zoom"),
    fit: $("fit"),
    output: $("output"),
    stats: $("stats"),
    copy: $("copy"),
    share: $("share"),
    download: $("download"),
    shareImage: $("share-image"),
    copyLink: $("copy-link"),
    mobileBar: $("mobile-bar"),
    mobileStatus: $("mobile-status"),
    mobileFit: $("mobile-fit"),
    mobileCopy: $("mobile-copy"),
    mobileShare: $("mobile-share"),
    picker: $("picker"),
    pickerBody: $("picker-body"),
    pickerPreview: $("picker-preview"),
    pickerClear: $("picker-clear"),
    pickerBackspace: $("picker-backspace"),
    pickerDone: $("picker-done"),
    toast: $("toast"),
  };

  const state = loadState();
  let grid = [];

  // ---------- persistence ----------

  function loadState() {
    const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
    try {
      applySaved(s, JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      // Storage blocked or corrupted: start with defaults.
    }
    return s;
  }

  // Copies the valid fields of `saved` (from storage or a design link) into `s`.
  // Design links come from outside, so everything is type-checked and size-capped.
  function applySaved(s, saved) {
    if (!saved || typeof saved !== "object") return;
    const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

    if (typeof saved.text === "string") s.text = saved.text.slice(0, MAX_TEXT);
    if (typeof saved.emojis === "string") s.emojis = saved.emojis.slice(0, 200);
    if (["turns", "mix"].includes(saved.mode)) s.mode = saved.mode;
    s.depth = EmojiArt.clampDepth(saved.depth, s.depth);
    if (EmojiArt.PATTERNS.includes(saved.pattern)) s.pattern = saved.pattern;
    if (Number.isInteger(saved.seed)) s.seed = saved.seed;
    if (["horizontal", "vertical"].includes(saved.layout)) s.layout = saved.layout;
    if (has(EmojiArt.PLATFORMS, saved.platform)) s.platform = saved.platform;
    if (BACKGROUNDS.includes(saved.background)) s.background = saved.background;
    else if (BACKGROUNDS.includes(saved.blank)) s.background = saved.blank; // settings from v2
    if (typeof saved.customBlank === "string") s.customBlank = saved.customBlank.slice(0, 16);
    if (saved.spacing && typeof saved.spacing === "object") {
      for (const [platform, value] of Object.entries(saved.spacing)) {
        const width = EmojiArt.normalizeSpacing(value); // also migrates the old A-H letters
        if (has(EmojiArt.PLATFORMS, platform) && width !== null) s.spacing[platform] = width;
      }
    }
    if (Number.isFinite(saved.zoom)) s.zoom = Math.min(40, Math.max(4, saved.zoom));
    if (typeof saved.fit === "boolean") s.fit = saved.fit;
    if (saved.custom && typeof saved.custom === "object") {
      s.custom = {};
      for (const [key, conf] of Object.entries(saved.custom)) {
        // only real font characters (this also rules out keys like "__proto__")
        if (!has(EmojiArt.GLYPHS, key) || !conf || typeof conf !== "object") continue;
        s.custom[key] = {
          emojis: typeof conf.emojis === "string" ? conf.emojis.slice(0, 200) : "",
          depth: conf.depth == null ? null : EmojiArt.clampDepth(conf.depth),
        };
      }
    }
    if (Array.isArray(saved.recent)) {
      s.recent = saved.recent.filter((e) => typeof e === "string" && e.length <= 16).slice(0, MAX_RECENT);
    }
  }

  // ---------- design links ----------

  function designLink() {
    const design = {};
    for (const key of DESIGN_KEYS) design[key] = state[key];
    const url = new URL(location.href);
    url.hash = "d=" + EmojiArt.encodeDesign(design);
    return url.href;
  }

  // Opening a design link loads its design, then removes it from the address bar so later
  // edits (saved in localStorage) aren't overwritten by the link on refresh.
  function loadDesignFromLink() {
    const match = location.hash.match(/^#d=([A-Za-z0-9_-]+)$/);
    if (!match) return false;
    const design = EmojiArt.decodeDesign(match[1]);
    history.replaceState(null, "", location.pathname + location.search);
    if (!design) return false;
    const picked = {};
    for (const key of DESIGN_KEYS) if (key in design) picked[key] = design[key];
    applySaved(state, picked);
    return true;
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Private mode / storage full: settings just won't be remembered.
      }
    }, 250);
  }

  // ---------- helpers ----------

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // The emoji drawn in empty cells, or null when the background is invisible.
  function visibleBlank() {
    if (state.background === "custom") return EmojiArt.parseEmojis(state.customBlank)[0] || SQUARE_BLANKS.white;
    return SQUARE_BLANKS[state.background] || null;
  }

  // Picks the spacing whose invisible gap is as wide as an emoji in this device's fonts.
  // Apps on the same phone mostly use the same emoji font, so this is the best default;
  // the fine-tune test covers apps that bring their own emoji set.
  function detectSpacing() {
    try {
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font-size:40px;" +
        "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji'";
      document.body.appendChild(probe);
      const measure = (s) => {
        probe.textContent = s.repeat(10);
        return probe.getBoundingClientRect().width;
      };
      const target = measure("😀".repeat(8));
      let best = EmojiArt.DEFAULT_SPACING;
      let bestDiff = Infinity;
      for (const s of EmojiArt.SPACINGS) {
        const diff = Math.abs(measure(EmojiArt.testGap(s.width)) - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s.width;
        }
      }
      probe.remove();
      return target > 0 ? best : EmojiArt.DEFAULT_SPACING;
    } catch {
      return EmojiArt.DEFAULT_SPACING;
    }
  }

  let detectedSpacing = EmojiArt.DEFAULT_SPACING;

  function currentSpacing() {
    return state.spacing[state.platform] || detectedSpacing;
  }

  // The fine-tune test's line number for the current spacing.
  function currentSpacingLabel() {
    return EmojiArt.spacingStep(currentSpacing()).id;
  }

  function platformName() {
    return EmojiArt.PLATFORMS[state.platform].name;
  }

  function customConf(key) {
    return state.custom[key] || { emojis: "", depth: null };
  }

  function isCustomized(key) {
    const c = state.custom[key];
    return !!c && (EmojiArt.parseEmojis(c.emojis).length > 0 || c.depth != null);
  }

  function setCustom(key, patch) {
    const next = { ...customConf(key), ...patch };
    if (!next.emojis.trim() && next.depth == null) delete state.custom[key];
    else state.custom[key] = next;
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2000);
  }

  // ---------- segmented controls ----------

  function syncSegmented(group, value) {
    for (const btn of group.querySelectorAll("button")) {
      const on = btn.dataset.value === String(value);
      btn.setAttribute("aria-checked", on);
      btn.tabIndex = on ? 0 : -1;
    }
  }

  function setupSegmented(group, onChange) {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (btn) onChange(btn.dataset.value);
    });
    group.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const buttons = [...group.querySelectorAll("button[data-value]")];
      const current = buttons.indexOf(document.activeElement);
      const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = buttons[(current + step + buttons.length) % buttons.length];
      next.focus();
      next.click();
    });
  }

  function syncGlobalSegments() {
    for (const group of document.querySelectorAll(".segmented[data-setting]")) {
      syncSegmented(group, state[group.dataset.setting]);
    }
  }

  function setupSpacing() {
    for (const s of EmojiArt.SPACINGS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.dataset.value = s.id;
      btn.textContent = s.id;
      btn.setAttribute("aria-label", `Line ${s.id}`);
      els.spacing.appendChild(btn);
    }
    setupSegmented(els.spacing, (id) => {
      state.spacing[state.platform] = EmojiArt.SPACINGS.find((s) => s.id === id).width;
      update();
      showToast(`Saved spacing ${id} for ${platformName()} 👍`);
    });
    els.spacingReset.addEventListener("click", () => {
      delete state.spacing[state.platform];
      update();
    });
    els.copyTest.addEventListener("click", async () => {
      const ok = await copyText(EmojiArt.calibrationText(state.platform));
      showToast(ok ? `Test copied — now paste it in ${state.platform === "other" ? "the app" : platformName()}` : "Couldn't copy — please try again");
    });
  }

  function setupGlobalSegments() {
    for (const group of document.querySelectorAll(".segmented[data-setting]")) {
      const setting = group.dataset.setting;
      setupSegmented(group, (value) => {
        state[setting] = setting === "depth" ? EmojiArt.clampDepth(value) : value;
        syncSegmented(group, state[setting]);
        update();
      });
      syncSegmented(group, state[setting]);
    }
  }

  // ---------- per-character rows ----------

  const rows = new Map(); // key -> { row, input, depth, badge }
  let shownKeys = "";

  function createRow(key) {
    const label = key === "?" ? "unsupported characters (?)" : `“${key}”`;
    const row = document.createElement("div");
    row.className = "char-row";
    row.innerHTML = `
      <span class="char-badge" aria-hidden="true"></span>
      <input type="text" autocomplete="off" spellcheck="false" placeholder="Default emojis">
      <button type="button" class="icon-btn picker-toggle">😀</button>
      <div class="row-depth">
        <span class="row-label" aria-hidden="true">Depth</span>
        <div class="segmented" role="radiogroup">
        <button type="button" role="radio" data-value="">Default</button>
        <button type="button" role="radio" data-value="1">1</button>
        <button type="button" role="radio" data-value="2">2</button>
        <button type="button" role="radio" data-value="3">3</button>
        </div>
      </div>
      <button type="button" class="link-btn char-reset">Reset</button>`;

    const badge = row.querySelector(".char-badge");
    const input = row.querySelector("input");
    const pick = row.querySelector(".picker-toggle");
    const depth = row.querySelector(".segmented");
    const reset = row.querySelector(".char-reset");

    badge.textContent = key;
    input.setAttribute("aria-label", `Emojis for ${label}`);
    pick.setAttribute("aria-label", `Pick emojis for ${label}`);
    pick.title = "Pick emojis";
    depth.setAttribute("aria-label", `Depth for ${label}`);
    reset.setAttribute("aria-label", `Reset ${label}`);

    input.addEventListener("input", () => {
      setCustom(key, { emojis: input.value });
      update();
    });
    pick.addEventListener("click", () => togglePicker(input, pick));
    setupSegmented(depth, (value) => {
      setCustom(key, { depth: value === "" ? null : EmojiArt.clampDepth(value) });
      update();
    });
    reset.addEventListener("click", () => {
      delete state.custom[key];
      update();
      input.focus();
    });

    const entry = { row, input, depth };
    rows.set(key, entry);
    return entry;
  }

  function syncRow(key) {
    const entry = rows.get(key) || createRow(key);
    const conf = customConf(key);
    if (entry.input.value !== conf.emojis) entry.input.value = conf.emojis;
    syncSegmented(entry.depth, conf.depth == null ? "" : conf.depth);
    entry.row.classList.toggle("customized", isCustomized(key));
    return entry.row;
  }

  function renderCharList() {
    const keys = EmojiArt.uniqueKeys(state.text);
    const signature = keys.join("\u0000");
    const rowEls = keys.map(syncRow);
    if (signature === shownKeys) return;
    shownKeys = signature;
    if (!keys.length) {
      els.charList.innerHTML = '<p class="char-empty">Type some text above and its characters will appear here.</p>';
      return;
    }
    els.charList.replaceChildren(...rowEls);
  }

  // ---------- preview ----------

  // Largest cell size that shows the whole width, and the whole height too unless that would
  // make cells smaller than 14px (tall stacked art scrolls vertically instead).
  function fitCellSize(width, height) {
    const availableW = els.output.clientWidth - 34 - 16; // padding + room for a scrollbar
    const availableH = window.innerHeight * 0.75 - 34;
    const byWidth = Math.floor(availableW / Math.max(width, 1));
    const byHeight = Math.max(14, Math.floor(availableH / Math.max(height, 1)));
    return Math.max(4, Math.min(40, byWidth, byHeight));
  }

  function applyZoom() {
    const { width, height } = EmojiArt.gridStats(grid);
    const size = state.fit ? fitCellSize(width, height) : state.zoom;
    els.output.style.setProperty("--cell", `${size}px`);
    els.zoom.value = size;
    els.fit.setAttribute("aria-pressed", state.fit);
  }

  function renderPreview() {
    const stats = EmojiArt.gridStats(grid);
    if (!grid.length) {
      els.output.innerHTML = '<p class="empty">Your emoji art will show up here.</p>';
      els.stats.textContent = "";
      return;
    }

    const blankEmoji = visibleBlank();
    const blank = blankEmoji ? `<span class="blank">${escapeHtml(blankEmoji)}</span>` : "<span></span>";
    let html = '<div class="art" role="img" aria-label="' + escapeHtml(`Emoji art of: ${state.text}`) + '">';
    for (const row of grid) {
      html += '<div class="art-row">';
      for (let x = 0; x < stats.width; x++) {
        const cell = row[x];
        html += cell ? `<span>${escapeHtml(cell)}</span>` : blank;
      }
      html += "</div>";
    }
    els.output.innerHTML = html + "</div>";
    els.stats.textContent = `${stats.emojis} emojis · ${stats.width} × ${stats.height} grid`;
    applyZoom();
  }

  function renderShare() {
    const name = platformName();
    const isOther = state.platform === "other";
    els.copy.textContent = isOther ? "Copy emoji text" : `Copy for ${name}`;
    for (const el of document.querySelectorAll(".platform-name")) el.textContent = isOther ? "the app" : name;
    els.customBlank.hidden = state.background !== "custom";

    const { width } = EmojiArt.gridStats(grid);
    const limit = EmojiArt.PLATFORMS[state.platform].maxWidth;
    const tooWide = !!limit && width > limit;
    els.fitWarning.hidden = !tooWide;
    if (tooWide) {
      els.fitWarningText.textContent =
        `This art is ${width} emojis wide, but ${name} on a phone fits only about ${limit} per line, ` +
        "so the lines would wrap and break the letters apart.";
    }

    const invisible = !visibleBlank();
    els.shareHint.textContent = invisible
      ? `Empty spaces are sized to match emoji width and every line is protected so ${isOther ? "apps" : name} can't trim it. ` +
        "Emoji fonts differ between phones: if it looks slightly off, fine-tune below, or pick ⬜/⬛ to line up perfectly everywhere."
      : "Every cell is an emoji, so it lines up exactly the same on every phone and app.";
    els.tune.hidden = !invisible;

    syncSegmented(els.spacing, currentSpacingLabel());
    const saved = !!state.spacing[state.platform];
    els.spacingStatus.textContent = saved
      ? `Using spacing ${currentSpacingLabel()} for ${isOther ? "other apps" : name} (from your test, saved on this device).`
      : `Using spacing ${currentSpacingLabel()}, auto-detected for this device's emoji size.`;
    els.spacingReset.hidden = !saved;

    els.mobileStatus.textContent = !grid.length
      ? "Type some text"
      : tooWide
        ? "⚠️ Too wide"
        : limit
          ? `✅ Fits ${name}`
          : `${width} emojis wide`;
    els.mobileFit.hidden = !tooWide;
  }

  function update() {
    const custom = {};
    for (const [key, conf] of Object.entries(state.custom)) {
      custom[key] = { emojis: EmojiArt.parseEmojis(conf.emojis), depth: conf.depth };
    }
    grid = EmojiArt.trimGrid(
      EmojiArt.buildGrid(state.text, {
        emojis: EmojiArt.parseEmojis(state.emojis),
        mode: state.mode,
        pattern: state.pattern,
        depth: state.depth,
        layout: state.layout,
        seed: state.seed,
        custom,
      })
    );
    renderPreview();
    renderCharList();
    renderShare();
    els.counter.textContent = `${state.text.length}/${MAX_TEXT}`;
    els.counter.classList.toggle("full", state.text.length >= MAX_TEXT);
    els.unsupported.hidden = !EmojiArt.hasUnsupported(state.text);
    els.shuffle.disabled = state.pattern !== "random";
    save();
  }

  // ---------- emoji picker ----------

  let pickerTarget = null;

  const recentGroup = document.createElement("div");

  function emojiButton(emoji) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = emoji;
    btn.dataset.emoji = emoji;
    btn.setAttribute("aria-label", `Add ${emoji}`);
    return btn;
  }

  function renderRecent() {
    recentGroup.hidden = !state.recent.length;
    recentGroup.querySelector(".picker-grid").replaceChildren(...state.recent.map(emojiButton));
  }

  function rememberEmoji(emoji) {
    state.recent = [emoji, ...state.recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    renderRecent();
    save();
  }

  function buildPicker() {
    recentGroup.className = "picker-group";
    recentGroup.innerHTML = '<h3>Recently used</h3><div class="picker-grid"></div>';
    els.pickerBody.appendChild(recentGroup);
    renderRecent();
    for (const group of PICKER_GROUPS) {
      const section = document.createElement("div");
      section.className = "picker-group";
      const title = document.createElement("h3");
      title.textContent = group.name;
      const gridEl = document.createElement("div");
      gridEl.className = "picker-grid";
      for (const emoji of EmojiArt.parseEmojis(group.emojis)) gridEl.appendChild(emojiButton(emoji));
      section.append(title, gridEl);
      els.pickerBody.appendChild(section);
    }
  }

  function setPickerValue(value) {
    pickerTarget.value = value;
    pickerTarget.dispatchEvent(new Event("input", { bubbles: true }));
    els.pickerPreview.textContent = EmojiArt.parseEmojis(value).join("");
  }

  function positionPicker(anchor) {
    const r = anchor.getBoundingClientRect();
    const width = els.picker.offsetWidth;
    const left = Math.min(
      Math.max(8, r.right - width),
      document.documentElement.clientWidth - width - 8
    );
    els.picker.style.left = `${left + window.scrollX}px`;
    els.picker.style.top = `${r.bottom + window.scrollY + 6}px`;
  }

  function openPicker(input, anchor) {
    pickerTarget = input;
    els.pickerPreview.textContent = EmojiArt.parseEmojis(input.value).join("");
    els.picker.hidden = false;
    positionPicker(anchor);
  }

  function closePicker() {
    els.picker.hidden = true;
    pickerTarget = null;
  }

  function togglePicker(input, anchor) {
    if (!els.picker.hidden && pickerTarget === input) closePicker();
    else openPicker(input, anchor);
  }

  function setupPicker() {
    buildPicker();
    els.pickerBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-emoji]");
      if (!btn || !pickerTarget) return;
      setPickerValue(pickerTarget.value + btn.dataset.emoji);
      rememberEmoji(btn.dataset.emoji);
    });
    els.pickerBackspace.addEventListener("click", () => {
      if (!pickerTarget) return;
      const parts = EmojiArt.splitGraphemes(pickerTarget.value.trimEnd());
      parts.pop();
      setPickerValue(parts.join(""));
    });
    els.pickerClear.addEventListener("click", () => pickerTarget && setPickerValue(""));
    els.pickerDone.addEventListener("click", closePicker);
    document.addEventListener("pointerdown", (e) => {
      if (els.picker.hidden) return;
      if (els.picker.contains(e.target) || e.target.closest(".picker-toggle")) return;
      closePicker();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.picker.hidden) closePicker();
    });
    window.addEventListener("resize", closePicker);
  }

  // ---------- copy & download ----------

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for browsers that block the clipboard API (e.g. page opened from a file).
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function artText() {
    return EmojiArt.formatForPlatform(grid, {
      platform: state.platform,
      background: state.background,
      customBlank: state.customBlank,
      spacing: currentSpacing(),
    });
  }

  // Switches to the stacked layout and lowers the depth until the art fits the app's width.
  function makeFit() {
    const limit = EmojiArt.PLATFORMS[state.platform].maxWidth;
    if (!limit) return;
    state.layout = "vertical";
    for (let d = state.depth; d >= EmojiArt.MIN_DEPTH; d--) {
      state.depth = d;
      update();
      if (EmojiArt.gridStats(grid).width <= limit) break;
    }
    syncGlobalSegments();
    const { width } = EmojiArt.gridStats(grid);
    showToast(
      width <= limit
        ? `Now ${width} emojis wide — fits ${platformName()} ✅`
        : "Still too wide: some characters have their own depth — lower it in step 3"
    );
  }

  function pngName() {
    const name = state.text.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 30) || "art";
    return `emojify-${name.toLowerCase()}.png`;
  }

  // Draws the art on a canvas and resolves with a PNG blob (null if the browser fails).
  function pngBlob() {
    const { width, height } = EmojiArt.gridStats(grid);
    const cell = Math.max(8, Math.min(48, Math.floor(8000 / Math.max(width, height))));
    const pad = cell;
    const canvas = document.createElement("canvas");
    canvas.width = width * cell + pad * 2;
    canvas.height = height * cell + pad * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.round(cell * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const blank = visibleBlank();
    grid.forEach((row, y) => {
      for (let x = 0; x < width; x++) {
        const emoji = row[x] || blank;
        if (emoji) ctx.fillText(emoji, pad + x * cell + cell / 2, pad + y * cell + cell / 2 + cell * 0.04);
      }
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function downloadPng() {
    const blob = await pngBlob();
    if (!blob) {
      showToast("Couldn't create the image");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = pngName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("Image downloaded 🖼️");
  }

  // ---------- native share (phones) ----------

  const canShareText = typeof navigator.share === "function";
  const canShareFiles = (() => {
    try {
      return (
        canShareText &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File(["x"], "x.png", { type: "image/png" })] })
      );
    } catch {
      return false;
    }
  })();

  async function shareText() {
    const text = artText();
    try {
      await navigator.share({ text });
    } catch (e) {
      if (e.name === "AbortError") return; // user closed the share sheet
      const ok = await copyText(text);
      showToast(ok ? "Sharing isn't available here — copied instead" : "Couldn't share — please try Copy");
    }
  }

  async function shareImage() {
    const blob = await pngBlob();
    if (!blob) {
      showToast("Couldn't create the image");
      return;
    }
    try {
      await navigator.share({ files: [new File([blob], pngName(), { type: "image/png" })] });
    } catch (e) {
      if (e.name !== "AbortError") showToast("Couldn't share the image — try Download PNG");
    }
  }

  // Every copy/share action needs some art first.
  function withArt(action) {
    return () => {
      if (!grid.length) {
        showToast("Type some text first");
        els.text.focus();
        return;
      }
      action();
    };
  }

  async function copyArt() {
    const ok = await copyText(artText());
    const where = state.platform === "other" ? "anywhere" : `in ${platformName()}`;
    showToast(ok ? `Copied! Paste it ${where} 🎉` : "Couldn't copy — please try again");
  }

  // ---------- ideas & surprise ----------

  function setupIdeas() {
    for (const idea of IDEAS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = idea;
      btn.addEventListener("click", () => {
        els.text.value = idea;
        state.text = idea;
        update();
      });
      els.ideas.appendChild(btn);
    }
  }

  // Random emojis, mixing mode and pattern. Leaves text, depth and layout alone so the art
  // keeps fitting the chosen app.
  function surprise() {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const pool = PICKER_GROUPS.flatMap((g) => EmojiArt.parseEmojis(g.emojis)).filter((e) => !/[⬛⬜]/u.test(e));
    const emojis =
      Math.random() < 0.4
        ? pick(PRESETS).emojis
        : Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => pick(pool)).join("");
    state.emojis = emojis;
    state.mode = pick(["turns", "mix"]);
    state.pattern = pick(EmojiArt.PATTERNS);
    state.seed = Math.floor(Math.random() * 1e9);
    els.emojis.value = emojis;
    els.pattern.value = state.pattern;
    syncGlobalSegments();
    update();
    showToast("🎲 New style! Tap again for another");
  }

  // ---------- wiring ----------

  function setupPresets() {
    for (const preset of PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";
      btn.title = preset.name;
      btn.setAttribute("aria-label", `Use ${preset.name} preset: ${preset.emojis}`);
      btn.textContent = preset.emojis;
      btn.addEventListener("click", () => {
        els.emojis.value = preset.emojis;
        state.emojis = preset.emojis;
        update();
      });
      els.presets.appendChild(btn);
    }
  }

  function init() {
    const fromLink = loadDesignFromLink();
    els.text.maxLength = MAX_TEXT;
    els.text.value = state.text;
    els.emojis.value = state.emojis;
    els.pattern.value = state.pattern;
    els.background.value = state.background;
    els.customBlank.value = state.customBlank;

    detectedSpacing = detectSpacing();
    setupIdeas();
    setupPresets();
    setupGlobalSegments();
    setupSpacing();
    setupPicker();

    els.text.addEventListener("input", () => {
      state.text = els.text.value;
      update();
    });
    els.emojis.addEventListener("input", () => {
      state.emojis = els.emojis.value;
      update();
    });
    document
      .querySelector('[data-picker-for="emojis"]')
      .addEventListener("click", (e) => togglePicker(els.emojis, e.currentTarget));
    document.querySelector('[data-picker-for="emojis"]').classList.add("picker-toggle");

    els.pattern.addEventListener("change", () => {
      state.pattern = els.pattern.value;
      update();
    });
    els.shuffle.addEventListener("click", () => {
      state.seed = Math.floor(Math.random() * 1e9);
      update();
    });
    els.resetAll.addEventListener("click", () => {
      if (!Object.keys(state.custom).length) {
        showToast("Nothing to reset");
        return;
      }
      state.custom = {};
      update();
      showToast("All characters use the defaults again");
    });
    els.background.addEventListener("change", () => {
      state.background = els.background.value;
      update();
      if (state.background === "custom") els.customBlank.focus();
    });
    els.makeFit.addEventListener("click", makeFit);
    els.customBlank.addEventListener("input", () => {
      state.customBlank = els.customBlank.value;
      update();
    });
    els.zoom.addEventListener("input", () => {
      state.fit = false;
      state.zoom = Number(els.zoom.value);
      applyZoom();
      save();
    });
    els.fit.addEventListener("click", () => {
      state.fit = !state.fit;
      applyZoom();
      save();
    });
    window.addEventListener("resize", () => state.fit && applyZoom());

    els.surprise.addEventListener("click", surprise);

    els.copy.addEventListener("click", withArt(copyArt));
    els.mobileCopy.addEventListener("click", withArt(copyArt));
    els.download.addEventListener("click", withArt(downloadPng));
    els.mobileFit.addEventListener("click", makeFit);
    els.copyLink.addEventListener(
      "click",
      withArt(async () => {
        const ok = await copyText(designLink());
        showToast(ok ? "Link copied — anyone who opens it gets this design 🔗" : "Couldn't copy the link");
      })
    );
    if (canShareText) {
      els.share.hidden = false;
      els.mobileShare.hidden = false;
      els.share.addEventListener("click", withArt(shareText));
      els.mobileShare.addEventListener("click", withArt(shareText));
    }
    if (canShareFiles) {
      els.shareImage.hidden = false;
      els.shareImage.addEventListener("click", withArt(shareImage));
    }

    // The phone bar would cover the on-screen keyboard's view of inputs, so hide it while typing.
    document.addEventListener("focusin", (e) => {
      if (e.target.matches("input[type=text], textarea")) document.body.classList.add("typing");
    });
    document.addEventListener("focusout", () => document.body.classList.remove("typing"));

    update();
    if (fromLink) showToast("Design loaded from link ✨");
  }

  init();
})();
