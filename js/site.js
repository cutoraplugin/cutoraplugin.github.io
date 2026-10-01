import { createCora } from "./cora.js";
import { ui, sample, soundOn, setSound, warm } from "./sound.js";

const T = JSON.parse(document.getElementById("i18n-js").textContent);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const html = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: just not remembered */
    }
  },
};
const base = new URL($('link[rel="icon"]').getAttribute("href"), location.href).href.replace(/favicon\.svg$/, "");
const sfxUrl = (id) => `${base}sfx/${id}.mp3`;

// Runs only when the element is on screen (saves battery on phones).
const whenVisible = (el, on, off) => {
  new IntersectionObserver(([e]) => (e.isIntersecting ? on() : off && off()), { threshold: 0.2 }).observe(el);
};

/* ================= Header ================= */

const top = $(".top");
const onScroll = () => top.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Features dropdown
const modsBtn = $("#mods-btn");
const modsDrop = $("#mods-drop");
const setDrop = (open) => {
  modsBtn.setAttribute("aria-expanded", String(open));
  modsDrop.hidden = !open;
};
modsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setDrop(modsDrop.hidden);
});
document.addEventListener("click", (e) => {
  if (!modsDrop.hidden && !modsDrop.contains(e.target)) setDrop(false);
  const lang = $(".lang");
  if (lang.open && !lang.contains(e.target)) lang.open = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modsDrop.hidden) {
    setDrop(false);
    modsBtn.focus();
  }
  const lang = $(".lang");
  if (lang.open) {
    lang.open = false;
    lang.querySelector("summary").focus();
  }
  if (!sheet.hidden) setSheet(false);
});

// Mobile menu
const burger = $("#burger");
const sheet = $("#sheet");
const setSheet = (open) => {
  // The sheet starts right under the header, wherever it is (the language bar can push it down).
  if (open) sheet.style.top = Math.max(0, top.getBoundingClientRect().bottom) + "px";
  burger.setAttribute("aria-expanded", String(open));
  sheet.hidden = !open;
  document.body.classList.toggle("locked", open);
};
burger.addEventListener("click", () => setSheet(sheet.hidden));
sheet.addEventListener("click", (e) => e.target.closest("a") && setSheet(false));
matchMedia("(min-width: 1021px)").addEventListener("change", (e) => e.matches && setSheet(false));

// Theme: dark "Ember" or light, like the plugin. Remembered on this device.
const themeBtn = $("#theme-toggle");
const coras = [];
const applyTheme = (t) => {
  html.dataset.theme = t;
  themeBtn.setAttribute("aria-pressed", String(t === "ember"));
  $('meta[name="theme-color"]').setAttribute("content", t === "light" ? "#f1f2f6" : "#130b07");
  coras.forEach((c) => c.restyle());
};
applyTheme(html.dataset.theme === "light" ? "light" : "ember");
themeBtn.addEventListener("click", () => {
  const t = html.dataset.theme === "light" ? "ember" : "light";
  store.set("cutora-theme", t);
  applyTheme(t);
  ui("select");
});

// Sound switch
const soundBtn = $("#sound-toggle");
soundBtn.setAttribute("aria-pressed", String(soundOn()));
soundBtn.addEventListener("click", () => {
  const on = !soundOn();
  setSound(on);
  soundBtn.setAttribute("aria-pressed", String(on));
  if (on) ui("select");
});

// Language: remember an explicit choice; suggest the visitor's language with a bar, never redirect.
$$("[data-lang-link]").forEach((a) => a.addEventListener("click", () => store.set("cutora-lang", a.dataset.langLink)));
(() => {
  const here = html.lang;
  if (store.get("cutora-lang") || store.get("cutora-langbar")) return;
  const wanted = (navigator.languages || [navigator.language || ""]).map((x) => x.slice(0, 2).toLowerCase());
  const first = wanted.find((x) => T.langs.includes(x));
  if (!first || first === here) return;
  const bar = T.bar[first];
  const link = $(`[data-lang-link="${first}"]`);
  if (!bar || !link) return;
  $("#langbar-text").textContent = bar.text;
  $("#langbar-text").lang = first;
  const go = $("#langbar-go");
  go.textContent = bar.go;
  go.lang = first;
  go.href = link.getAttribute("href");
  go.addEventListener("click", () => store.set("cutora-lang", first));
  const x = $("#langbar-x");
  x.setAttribute("aria-label", bar.close);
  x.addEventListener("click", () => {
    store.set("cutora-langbar", "closed");
    $("#langbar").hidden = true;
  });
  $("#langbar").hidden = false;
})();

// Buy: a dialog with the ways to pay (Lava.top, Hipolink, crypto). Ways without a link yet
// are shown disabled ("Soon"). Esc, the close button and a click outside close it.
const buyDialog = $("#buy-dialog");
if (buyDialog) {
  $$(".pay-btn").forEach((b) => b.addEventListener("click", () => buyDialog.showModal()));
  $(".buy-close", buyDialog).addEventListener("click", () => buyDialog.close());
  buyDialog.addEventListener("click", (e) => e.target === buyDialog && buyDialog.close());
  $$('.pay-opt[aria-disabled="true"]', buyDialog).forEach((o) => o.addEventListener("click", (e) => e.preventDefault()));
}

// Copy buttons (the crypto wallet address).
for (const b of document.querySelectorAll("[data-copy]")) {
  b.addEventListener("click", async () => {
    const text = document.querySelector(b.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(document.querySelector(b.dataset.copy));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      document.execCommand("copy");
    }
    const was = b.textContent;
    b.textContent = b.dataset.done;
    setTimeout(() => (b.textContent = was), 1800);
  });
}

warm([sfxUrl("fs-632763")]);

/* ================= Cora ================= */

const heroCanvas = $("#cora");
let hero = null;
if (heroCanvas) {
  const bubble = $(".bubble");
  let line = 0;
  const say = (text) => {
    bubble.classList.add("swap");
    setTimeout(() => {
      bubble.textContent = text;
      bubble.classList.remove("swap");
    }, 220);
  };
  hero = createCora(heroCanvas, {
    onPoke: () => {
      ui("poke");
      if (heroCanvas.dataset.cheer) return;
      line = (line + 1) % T.cora.length;
      say(T.cora[line]);
      setTimeout(() => ui("talk"), 180);
    },
  });
  coras.push(hero);
  // Thank-you page: she celebrates once when the page opens.
  if (heroCanvas.dataset.cheer) setTimeout(() => hero.cheer(), 500);
}

const miniCanvas = $("#cora-mini");
if (miniCanvas) {
  const mini = createCora(miniCanvas, { seed: 29, onPoke: () => ui("poke") });
  coras.push(mini);
  let lastCheer = 0;
  const cheer = () => {
    const now = performance.now();
    if (now - lastCheer < 2500) return;
    lastCheer = now;
    mini.cheer();
  };
  $$(".pay-btn").forEach((b) => {
    b.addEventListener("pointerenter", cheer);
    b.addEventListener("focus", cheer);
  });
}

/* ================= Module tabs (home) ================= */

const rail = $(".rail");
if (rail) {
  const pill = $(".rail-pill", rail);
  const tabs = $$("[role=tab]", rail);
  const placePill = () => {
    const tab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    pill.style.width = tab.offsetWidth + "px";
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  };
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    requestAnimationFrame(placePill);
    if (focus) tab.focus();
  };
  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      if (t.getAttribute("aria-selected") !== "true") ui("tab");
      select(t);
    }),
  );
  rail.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const rtl = html.dir === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    if (step) {
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      select(tabs[e.key === "Home" ? 0 : tabs.length - 1], true);
    }
  });
  const ro = new ResizeObserver(placePill);
  ro.observe(rail);
  tabs.forEach((t) => ro.observe(t));
  document.fonts && document.fonts.ready.then(placePill);
  placePill();
}

/* ================= Cut demo: waveform ================= */

const wave = $(".wave");
if (wave) {
  const slider = $("#threshold");
  const out = $("#threshold-out");
  const btn = $("#cut-btn");
  const lenOut = $("#len");
  const savedOut = $("#saved");

  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 101 bars make a 1:30 clip. Each pause has its own loudness; the slider decides which count.
  const plan = [
    ["s", 9], ["p", 3, -44], ["s", 12], ["p", 2, -35], ["s", 7], ["p", 4, -47], ["s", 10],
    ["p", 2, -29], ["s", 8], ["p", 3, -41], ["s", 11], ["p", 2, -38], ["s", 6], ["p", 3, -50],
    ["s", 9], ["p", 2, -33], ["s", 8],
  ];
  const SEC = 90 / plan.reduce((a, p) => a + p[1], 0);
  const segs = plan.map(([kind, n, db]) => {
    const el = document.createElement("div");
    el.className = "seg" + (kind === "p" ? " pause" : "");
    el.style.setProperty("--n", n);
    for (let i = 0; i < n; i++) {
      const bar = document.createElement("i");
      const v = kind === "s" ? 0.35 + 0.6 * Math.sin((Math.PI * (i + 0.5)) / n) * (0.55 + rnd() * 0.45) : 0.04 + rnd() * 0.06 + (db + 50) / 400;
      bar.style.setProperty("--v", Math.round(Math.min(0.95, v) * 100) + "%");
      el.appendChild(bar);
    }
    wave.appendChild(el);
    return { el, n, db: db ?? 0, pause: kind === "p" };
  });
  const total = segs.reduce((a, s) => a + s.n, 0) * SEC;
  let cut = false;
  const time = (sec) => {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const marked = () => segs.filter((s) => s.pause && s.db < Number(slider.value));
  const render = () => {
    const v = Number(slider.value);
    out.value = `${v} dB`;
    slider.style.setProperty("--fill", ((v - slider.min) / (slider.max - slider.min)) * 100 + "%");
    const m = marked();
    segs.forEach((s) => s.el.classList.toggle("marked", s.pause && s.db < v));
    const removed = m.reduce((a, s) => a + s.n, 0) * SEC;
    lenOut.textContent = time(cut ? total - removed : total);
    savedOut.textContent = time(removed);
    btn.textContent = cut ? T.undo : m.length ? fmt(T.cutN, { n: m.length }) : T.cutNone;
    btn.disabled = !cut && m.length === 0;
    slider.disabled = cut;
  };
  slider.addEventListener("input", render);
  btn.addEventListener("click", () => {
    cut = !cut;
    marked().forEach((s) => s.el.classList.toggle("cut", cut));
    if (cut) {
      sample(sfxUrl("fs-632763"));
      setTimeout(() => ui("success"), 650);
      hero && hero.cheer();
    } else ui("select");
    render();
  });
  render();
}

/* ================= Captions: style showcase ================= */

const cap = $("#cap");
if (cap) {
  const words = T.capWords.split(/\s+/);
  const cues = [];
  for (let i = 0; i < words.length; i += 3) cues.push(words.slice(i, i + 3));
  let style = "pop";
  let timer = 0;
  let cue = 0;
  let word = 0;
  let running = false;

  const renderCue = () => {
    cap.textContent = "";
    for (const w of cues[cue]) {
      const s = document.createElement("span");
      if (style === "type") for (const ch of w) s.appendChild(Object.assign(document.createElement("i"), { textContent: ch }));
      else s.textContent = w;
      cap.appendChild(s);
    }
  };
  const tick = () => {
    const spans = [...cap.children];
    if (word >= spans.length) {
      cue = (cue + 1) % cues.length;
      word = 0;
      renderCue();
      timer = setTimeout(tick, cue === 0 ? 700 : 120);
      return;
    }
    spans.forEach((s, i) => {
      s.classList.toggle("on", style === "karaoke" ? true : i <= word);
      s.classList.toggle("now", i === word);
    });
    if (style === "type") {
      // Letters appear one by one inside the current word.
      const letters = [...spans[word].children];
      let k = 0;
      const typeNext = () => {
        if (k < letters.length) {
          letters[k++].classList.add("on");
          timer = setTimeout(typeNext, 45);
        } else {
          word++;
          timer = setTimeout(tick, 140);
        }
      };
      typeNext();
      return;
    }
    word++;
    timer = setTimeout(tick, 360);
  };
  const start = () => {
    if (running) return;
    running = true;
    clearTimeout(timer);
    renderCue();
    word = 0;
    tick();
  };
  const stop = () => {
    running = false;
    clearTimeout(timer);
  };
  if (reduced) {
    renderCue();
    [...cap.children].forEach((s) => s.classList.add("on"));
  } else whenVisible(cap, start, stop);

  $$("[data-style]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!b.dataset.style || b === cap) return;
      $$("[data-style][role=radio]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      style = b.dataset.style;
      cap.dataset.style = style;
      ui("select");
      cue = 0;
      word = 0;
      stop();
      start();
    }),
  );
}

/* ================= Motion: linear vs Cutora curve ================= */

const clipLin = $("#clip-linear");
if (clipLin) {
  const clipCur = $("#clip-curve");
  const plot = $("#plot-cur");
  const nameEl = $("#curve-name");
  const CURVES = {
    soft: "cubic-bezier(0.16, 1, 0.3, 1)",
    smooth: "cubic-bezier(0.65, 0, 0.35, 1)",
    overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    bounce: null,
  };
  // Bounce as sampled keyframes (like the plugin, which bakes ~30 keys per segment).
  const bounceAt = (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  };
  const bezierAt = (p1x, p1y, p2x, p2y, x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * p1x * t * (1 - t) ** 2 + 3 * p2x * t * t * (1 - t) + t ** 3 - x;
      const dx = 3 * p1x * (1 - t) ** 2 + 6 * (p2x - p1x) * t * (1 - t) + 3 * (1 - p2x) * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }
    return 3 * p1y * t * (1 - t) ** 2 + 3 * p2y * t * t * (1 - t) + t ** 3;
  };
  const valueAt = (name, x) => {
    if (name === "bounce") return bounceAt(x);
    const [a, b, c, d] = CURVES[name].match(/[\d.]+/g).map(Number);
    return bezierAt(a, b, c, d, x);
  };
  const drawPlot = (name) => {
    let d = "";
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      d += `${i ? "L" : "M"}${(10 + x * 100).toFixed(1)} ${(70 - valueAt(name, x) * 60).toFixed(1)}`;
    }
    plot.setAttribute("d", d);
  };

  let curve = "soft";
  let anims = [];
  let loop = 0;
  const run = () => {
    anims.forEach((a) => a.cancel());
    // 85% of the track: an overshooting curve peaks past the end and must stay visible.
    const d = (clipLin.parentElement.clientWidth - clipLin.offsetWidth - 16) * 0.85;
    const opts = { duration: 1400, fill: "forwards" };
    const frames = (ease) => [{ transform: "translateX(0)" }, { transform: `translateX(${d}px)` }].map((f, i) => (i === 0 && ease ? { ...f, easing: ease } : f));
    const curFrames =
      curve === "bounce"
        ? Array.from({ length: 31 }, (_, i) => ({ transform: `translateX(${bounceAt(i / 30) * d}px)`, offset: i / 30 }))
        : frames(CURVES[curve]);
    anims = [clipLin.animate(frames("linear"), opts), clipCur.animate(curFrames, opts)];
    clearTimeout(loop);
    loop = setTimeout(run, 2600);
  };
  const stop = () => {
    clearTimeout(loop);
  };
  drawPlot(curve);
  if (!reduced) whenVisible(clipLin, run, stop);
  $$("[data-curve]").forEach((b) =>
    b.addEventListener("click", () => {
      $$("[data-curve]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      curve = b.dataset.curve;
      nameEl.textContent = b.textContent;
      drawPlot(curve);
      ui("select");
      if (!reduced) run();
    }),
  );
}

/* ================= Sounds: listen ================= */

const plays = $$(".play[data-sfx]");
if (plays.length) {
  warm(plays.map((b) => sfxUrl(b.dataset.sfx)));
  plays.forEach((b) =>
    b.addEventListener("click", async () => {
      plays.forEach((x) => x.classList.remove("playing"));
      b.classList.add("playing");
      // The listen buttons always play: that's what they're for, even with interface sounds off.
      await sample(sfxUrl(b.dataset.sfx), { force: true });
      b.classList.remove("playing");
    }),
  );
}

/* ================= Media: import by link ================= */

const linkText = $("#link-text");
if (linkText) {
  const btn = $("#link-btn");
  const result = $("#link-result");
  let t = 0;
  let done = false;
  const type = (i = 0) => {
    linkText.textContent = T.link.slice(0, i);
    if (i < T.link.length) t = setTimeout(() => type(i + 1), 28);
  };
  const reset = () => {
    clearTimeout(t);
    result.classList.remove("show");
    done = false;
    type();
  };
  if (reduced) linkText.textContent = T.link;
  else whenVisible(linkText, () => !done && linkText.textContent.length === 0 && type());
  btn.addEventListener("click", () => {
    if (done) {
      reset();
      return;
    }
    clearTimeout(t);
    linkText.textContent = T.link;
    result.classList.add("show");
    done = true;
    ui("success");
  });
}

/* ================= Cora: chat ================= */

const log = $("#chat-log");
if (log) {
  const qs = $("#chat-q");
  const add = (cls, text) => {
    const m = document.createElement("p");
    m.className = "msg " + cls;
    m.textContent = text;
    log.appendChild(m);
    log.scrollTo({ top: log.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  };
  // Her greeting without the "tap me" part: the first sentence only.
  add("cora", T.cora[0].split(/(?<=[.!?؟])\s/)[0]);
  T.chat.forEach(([q, a]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => {
      add("me", q);
      ui("select");
      setTimeout(() => {
        add("cora", a);
        ui("talk");
        hero && hero.giggle();
      }, 450);
    });
    qs.appendChild(b);
  });
}
