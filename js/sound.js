// Sounds on the site play only in answer to a tap or click, never on their own.
// Cora's voice and the interface taps are synthesized exactly like the plugin's
// (C:\cutora\src\js\lib\uisound.ts); the showcase effects are the plugin's own CC0 recordings.
// A header switch mutes everything; the choice is remembered on this device.

const KEY = "cutora-sound";
let ctx = null;
let bus = null;
let last = 0;
const buffers = new Map();

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSound = (on) => {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* not remembered in private mode */
  }
};

const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const output = (ac) => {
  if (bus) return bus;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 140;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 9000;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  hp.connect(lp);
  lp.connect(comp);
  comp.connect(ac.destination);
  bus = hp;
  return bus;
};

const tone = (ac, out, at, f0, dur, peak, opt = {}) => {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(out);
  for (const [mul, level] of [[1, 1], [2, opt.octave ?? 0.18]]) {
    if (level <= 0) continue;
    const o = ac.createOscillator();
    const vg = ac.createGain();
    o.type = mul === 1 ? opt.type || "sine" : "sine";
    o.frequency.setValueAtTime(f0 * mul, at);
    if (opt.glide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f0 * opt.glide * mul), at + dur * 0.8);
    vg.gain.value = level;
    o.connect(vg);
    vg.connect(g);
    o.start(at);
    o.stop(at + dur + 0.03);
  }
};

const tap = (ac, out, at, freq, peak, dur = 0.006) => {
  const len = Math.max(8, Math.ceil(ac.sampleRate * dur));
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ac.createBufferSource();
  src.buffer = b;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = peak;
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(at);
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const RECIPES = {
  tab: (ac, o, t) => {
    tap(ac, o, t, 2600, 0.35);
    tone(ac, o, t, 740, 0.09, 0.26, { glide: 1.12 });
  },
  select: (ac, o, t) => {
    tap(ac, o, t, 3000, 0.28);
    tone(ac, o, t, 988, 0.07, 0.2, { octave: 0.12 });
  },
  poke: (ac, o, t) => {
    const v = pick([[420, 2.1, 0.85], [520, 1.8, 0.8], [360, 2.4, 0.9], [600, 1.5, 0.7]]);
    tone(ac, o, t, v[0], 0.13, 0.26, { glide: v[1], octave: 0.25 });
    tone(ac, o, t + 0.11, v[0] * v[1], 0.16, 0.18, { glide: v[2], octave: 0.2 });
  },
  cheer: (ac, o, t) => {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(ac, o, t + i * 0.075, f, 0.32, 0.16, { octave: 0.25 }));
  },
  talk: (ac, o, t) => {
    const base = pick([660, 740, 830, 880]);
    const n = pick([2, 3, 3, 4]);
    for (let i = 0; i < n; i++) tone(ac, o, t + i * 0.055, base * pick([1, 1.12, 1.26, 0.89]), 0.06, 0.13, { glide: pick([1.1, 0.92, 1.18]), octave: 0.15 });
  },
  success: (ac, o, t) => {
    [1047, 1319, 1568].forEach((f, i) => tone(ac, o, t + i * 0.065, f, 0.5, 0.17, { octave: 0.3 }));
  },
};

/** A synthesized interface sound. */
export const ui = (name) => {
  if (!soundOn()) return;
  const now = performance.now();
  if (now - last < 35) return;
  last = now;
  try {
    const ac = audio();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = 0.24;
    master.connect(output(ac));
    RECIPES[name](ac, master, ac.currentTime + 0.005);
    setTimeout(() => master.disconnect(), 1500);
  } catch {
    /* no audio device */
  }
};

let current = null;

/** A recorded effect from the plugin's library. Returns a promise that resolves when it ends. */
export const sample = async (url, { force = false } = {}) => {
  if (!soundOn() && !force) return;
  const ac = audio();
  if (!ac) return;
  try {
    let buf = buffers.get(url);
    if (!buf) {
      const data = await (await fetch(url)).arrayBuffer();
      // Safari still ships the callback form of decodeAudioData.
      buf = await new Promise((res, rej) => ac.decodeAudioData(data, res, rej));
      buffers.set(url, buf);
    }
    if (current) {
      try {
        current.stop();
      } catch {}
    }
    const src = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.value = 0.8;
    src.buffer = buf;
    src.connect(g);
    g.connect(ac.destination);
    current = src;
    src.start();
    return new Promise((res) => (src.onended = () => res()));
  } catch {
    /* file missing or undecodable: stay silent */
  }
};

/** Fetch and decode ahead of time so the first tap plays instantly. */
export const warm = (urls) => {
  const run = () => {
    const ac = audio();
    if (!ac) return;
    urls.forEach(async (url) => {
      if (buffers.has(url)) return;
      try {
        const data = await (await fetch(url)).arrayBuffer();
        buffers.set(url, await new Promise((res, rej) => ac.decodeAudioData(data, res, rej)));
      } catch {}
    });
  };
  // An AudioContext may only start after a user gesture on iOS.
  window.addEventListener("pointerdown", run, { once: true, passive: true });
};
