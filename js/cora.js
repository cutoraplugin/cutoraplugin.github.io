// Cora for the website: a vanilla port of the plugin's Mascot.tsx (ember theme only).
// A jelly body with a flame tuft, wrapped in a glowing web of "neurons".
// Moods: happy (idle), look (eyes follow the pointer), surprised (fast swipe past her),
// giggle (tap her), sleepy (nobody touched the page for a while).
// Cost: glows are pre-rendered sprites, frame rate is capped (60 while reacting, 30 at rest,
// 15 asleep), drawing stops when she is off screen or the tab is hidden, and reduced motion
// gets a single still frame.

const NODE_COUNT = 42;
const LINK_DIST = 58;
const SLEEP_AFTER = 16;
const LOOK_FOR = 1.6;

// Colors follow the page theme (read from CSS tokens); light theme gets the plugin's angel look.
const COLORS = { a: "#ff6a14", b: "#ffbf3c", face: "#2a1206", light: false };
const readColors = () => {
  const cs = getComputedStyle(document.documentElement);
  COLORS.a = cs.getPropertyValue("--accent").trim() || COLORS.a;
  COLORS.b = cs.getPropertyValue("--accent-2").trim() || COLORS.b;
  COLORS.face = cs.getPropertyValue("--mascot-face").trim() || COLORS.face;
  COLORS.light = document.documentElement.dataset.theme === "light";
  glowSprite = null;
};

const sprite = (size, paint) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d"), size);
  return c;
};

var glowSprite = null;
const glow = () =>
  glowSprite ||
  (glowSprite = sprite(32, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.25, COLORS.b);
    g.addColorStop(0.55, COLORS.a + "55");
    g.addColorStop(1, COLORS.a + "00");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  }));

export function createCora(canvas, { seed = 11, onPoke } = {}) {
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let k = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The scene is ~300 units wide; scale it to the canvas.
    k = Math.max(0.6, Math.min(canvas.clientWidth, canvas.clientHeight) / 300);
    w = canvas.clientWidth / k;
    h = canvas.clientHeight / k;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  };
  resize();

  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const nodes = Array.from({ length: NODE_COUNT }, () => ({
    r: 64 + Math.pow(rnd(), 1.2) * 52,
    a: rnd() * Math.PI * 2,
    speed: (0.08 + rnd() * 0.16) * (rnd() > 0.5 ? 1 : -1),
    tilt: 0.78 + rnd() * 0.22,
    z: 0,
    size: 1.2 + rnd() * 1.8,
    x: 0,
    y: 0,
  }));
  const pulses = [];
  const particles = [];

  let time = 0;
  let mood = "happy";
  let moodBlink = 0;
  let blinkAt = 2.5;
  let winkUntil = 0;
  let nextWink = 9 + rnd() * 10;
  let giggleUntil = 0;
  let surprisedUntil = 0;
  let squash = 0;
  let squashV = 0;
  let kick = 0;
  let hop = 0;
  let hopV = 0;
  let hopsLeft = 0;
  let emberClock = 0;
  let zClock = 0;
  let bodyR = 50;

  // ---------- Pointer (mouse and touch) ----------
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, active: false, lastMove: performance.now(), speed: 0, over: false };
  const toScene = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / k - w / 2, y: (e.clientY - rect.top) / k - h / 2 };
  };
  const onMove = (e) => {
    const p = toScene(e);
    const now = performance.now();
    const dt = Math.max(1, now - ptr.lastMove) / 1000;
    ptr.speed = Math.hypot(p.x - ptr.tx, p.y - ptr.ty) / dt;
    ptr.tx = p.x;
    ptr.ty = p.y;
    ptr.active = true;
    ptr.lastMove = now;
    ptr.over = Math.hypot(p.x, p.y - 8) < bodyR * 1.1;
    if (e.pointerType === "mouse") canvas.style.cursor = ptr.over ? "pointer" : "";
    wake();
  };
  const onLeave = () => {
    ptr.active = false;
    ptr.over = false;
  };
  const onDown = (e) => {
    onMove(e);
    if (!ptr.over) return;
    giggle();
    onPoke && onPoke();
  };

  const giggle = () => {
    giggleUntil = time + 1.4;
    squashV += 5.5;
    kick = 16;
    for (let i = 0; i < 5; i++) {
      particles.push({ kind: "heart", x: (rnd() - 0.5) * bodyR * 1.4, y: -bodyR * 1.05, vx: (rnd() - 0.5) * 50, vy: -40 - rnd() * 40, life: 0, max: 1.2 + rnd() * 0.5 });
    }
    if (reduced) draw(0);
  };

  const cheer = () => {
    ptr.lastMove = performance.now();
    giggleUntil = time + 2.6;
    squashV += 7;
    kick = 34;
    hopV = 230;
    hopsLeft = 2;
    // Hearts rise from above her head and drift outwards: never across her face.
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      particles.push({ kind: "heart", x: side * (bodyR * 0.4 + rnd() * bodyR * 0.7), y: -bodyR * (0.9 + rnd() * 0.3), vx: side * (20 + rnd() * 50), vy: -60 - rnd() * 60, life: 0, max: 1.3 + rnd() * 0.8 });
    }
    for (let i = 0; i < 24; i++) {
      particles.push({ kind: "ember", x: (rnd() - 0.5) * bodyR * 1.2, y: -bodyR * 1.0, vx: (rnd() - 0.5) * 180, vy: -60 - rnd() * 140, life: 0, max: 0.8 + rnd() * 0.9 });
    }
    wake();
    if (reduced) draw(0);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);

  // ---------- Drawing helpers ----------
  const bodyGradient = (cx, cy, R) => {
    const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, R * 1.15);
    g.addColorStop(0, COLORS.b);
    g.addColorStop(0.55, COLORS.a);
    g.addColorStop(1, COLORS.a);
    return g;
  };

  const blobPath = (cx, cy, R, sx, sy, lean) => {
    const points = 9;
    const pts = [];
    for (let i = 0; i < points; i++) {
      const ang = (i / points) * Math.PI * 2;
      const wobble = Math.sin(time * 1.3 + i * 1.7) * 2.6 + Math.sin(time * 0.7 + i * 2.9) * 1.8;
      const flatBottom = Math.sin(ang) > 0 ? 0.9 : 1;
      const pull = (Math.cos(ang) * lean.x + Math.sin(ang) * lean.y) * 0.06;
      const r = (R + wobble + pull) * (i % 3 === 0 ? 1.04 : 1);
      pts.push([cx + Math.cos(ang) * r * sx, cy + Math.sin(ang) * r * flatBottom * sy]);
    }
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const p = pts[i % points];
      const n = pts[(i + 1) % points];
      const mx = (p[0] + n[0]) / 2;
      const my = (p[1] + n[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.closePath();
  };

  const dot = (x, y, size, alpha) => {
    ctx.globalAlpha = alpha;
    const d = size * 6;
    ctx.drawImage(glow(), x - d / 2, y - d / 2, d, d);
  };

  const surfaceShift = (ang, lean, sx, sy) => {
    const pull = (Math.cos(ang) * lean.x + Math.sin(ang) * lean.y) * 0.06;
    return { x: Math.cos(ang) * pull * sx, y: Math.sin(ang) * pull * sy };
  };

  const add = () => {
    if (!COLORS.light) ctx.globalCompositeOperation = "lighter";
  };

  const drawAngelWings = (cx, cy, R) => {
    for (const side of [-1, 1]) {
      const flap = Math.sin(time * 2.4) * 0.14;
      ctx.save();
      ctx.translate(cx + side * R * 0.74, cy - R * 0.12);
      ctx.scale(side, 1);
      ctx.rotate(-flap);
      for (const [ang, len, wid] of [[-0.95, R * 0.98, R * 0.3], [-0.55, R * 0.86, R * 0.27], [-0.15, R * 0.66, R * 0.24]]) {
        ctx.save();
        ctx.rotate(ang);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, "#fff4e4");
        g.addColorStop(1, "#ffffff");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(190,150,100,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  };

  const drawHalo = (cx, top, R, bob) => {
    const y = top - R * 0.34 + bob;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255, 196, 70, 0.35)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(cx, y, R * 0.52, R * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#f7bd3c";
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.restore();
  };

  const drawFlame = (cx, top) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const tongues = [
      [-11, 22, 8],
      [11, 20, 7.5],
      [0, 38, 12],
      [0, 20, 5.5],
    ];
    tongues.forEach(([off, hgt0, wdt], i) => {
      const hgt = hgt0 + Math.sin(time * 9 + i * 1.7) * 4 + Math.sin(time * 15 + i) * 2;
      const bx = cx + off + Math.sin(time * 3 + i) * 1.2;
      const by = top + 7;
      const tipx = bx + Math.sin(time * 5 + i * 2) * 3;
      const g = ctx.createLinearGradient(bx, by, bx, by - hgt);
      g.addColorStop(0, i === 3 ? "#ffffff" : COLORS.a);
      g.addColorStop(0.55, COLORS.b);
      g.addColorStop(1, COLORS.b + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - wdt, by);
      ctx.quadraticCurveTo(bx - wdt * 0.9, by - hgt * 0.55, tipx, by - hgt);
      ctx.quadraticCurveTo(bx + wdt * 0.9, by - hgt * 0.55, bx + wdt, by);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  };

  const drawFace = (cx, cy, R, look, blink, blush) => {
    const fx = cx + look.x * 6;
    const fy = cy + look.y * 4 + 2;
    const ex = R * 0.34;
    ctx.strokeStyle = COLORS.face;
    ctx.fillStyle = COLORS.face;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;

    if (blush) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 110, 150, 0.35)";
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(fx + sd * R * 0.55, fy + 5, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const happyEye = (x) => {
      ctx.beginPath();
      ctx.arc(x, fy - 3, 6.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    };
    const lineEye = (x) => {
      ctx.beginPath();
      ctx.moveTo(x - 6, fy - 6);
      ctx.lineTo(x + 6, fy - 6);
      ctx.stroke();
    };
    const openEye = (x, rx, ry) => {
      const px = x + look.x * 2;
      const py = fy - 5 + look.y * 1.5;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(px + 1.4 - look.x * 0.6, py - ry * 0.4, Math.max(1.2, rx * 0.32), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const smile = () => {
      ctx.beginPath();
      ctx.arc(fx, fy + 6, 5, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    };

    if (mood === "giggle") {
      for (const sd of [-1, 1]) {
        const x = fx + sd * ex;
        ctx.beginPath();
        ctx.moveTo(x - 5 * sd, fy - 10);
        ctx.lineTo(x + 3 * sd, fy - 5.5);
        ctx.lineTo(x - 5 * sd, fy - 1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(fx - 7, fy + 3);
      ctx.quadraticCurveTo(fx, fy + 16, fx + 7, fy + 3);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (mood === "sleepy") {
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(fx + sd * ex, fy - 7, 6, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
      }
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(fx, fy + 7, 2.4 + Math.sin(time * 1.2) * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (mood === "surprised") {
      if (blink) {
        lineEye(fx - ex);
        lineEye(fx + ex);
      } else {
        openEye(fx - ex, 5.4, 6.4);
        openEye(fx + ex, 5.4, 6.4);
      }
      ctx.beginPath();
      ctx.ellipse(fx, fy + 8, 3.4, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (mood === "look") {
      if (blink) {
        lineEye(fx - ex);
        lineEye(fx + ex);
      } else {
        if (winkUntil > time) happyEye(fx - ex);
        else openEye(fx - ex, 4.4, 5.6);
        openEye(fx + ex, 4.4, 5.6);
      }
      smile();
      return;
    }
    if (blink) {
      lineEye(fx - ex);
      lineEye(fx + ex);
    } else {
      happyEye(fx - ex);
      happyEye(fx + ex);
    }
    smile();
  };

  const drawParticles = (cx, cy, dt) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.max;
      const fade = 1 - t;
      const x = cx + p.x;
      const y = cy + p.y;
      ctx.save();
      if (p.kind === "ember") {
        add();
        dot(x, y, 1.1, fade);
      } else if (p.kind === "heart") {
        const sz = 5 + t * 3;
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#ff6f91";
        ctx.beginPath();
        ctx.moveTo(x, y + sz * 0.9);
        ctx.bezierCurveTo(x - sz * 1.4, y - sz * 0.2, x - sz * 0.6, y - sz * 1.2, x, y - sz * 0.4);
        ctx.bezierCurveTo(x + sz * 0.6, y - sz * 1.2, x + sz * 1.4, y - sz * 0.2, x, y + sz * 0.9);
        ctx.fill();
      } else {
        const sz = 4 + t * 5;
        ctx.globalAlpha = Math.min(1, fade * 1.4);
        ctx.strokeStyle = COLORS.light ? COLORS.face : COLORS.b;
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x - sz / 2, y - sz / 2);
        ctx.lineTo(x + sz / 2, y - sz / 2);
        ctx.lineTo(x - sz / 2, y + sz / 2);
        ctx.lineTo(x + sz / 2, y + sz / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // ---------- Frame ----------
  function draw(dt) {
    time += dt;
    const idle = (performance.now() - ptr.lastMove) / 1000;
    const sleepy = idle > SLEEP_AFTER && giggleUntil <= time;
    const pace = sleepy ? 0.3 : 1;

    if (ptr.active && idle < 0.25 && ptr.speed > 1400 && Math.hypot(ptr.tx, ptr.ty) < 130) surprisedUntil = time + 0.8;

    const next = giggleUntil > time ? "giggle" : sleepy ? "sleepy" : surprisedUntil > time ? "surprised" : ptr.active && idle < LOOK_FOR ? "look" : "happy";
    if (next !== mood) {
      if (next !== "giggle") moodBlink = 0.09;
      mood = next;
    }

    if (!ptr.active || sleepy) {
      ptr.tx = Math.cos(time * 0.4) * 20;
      ptr.ty = Math.sin(time * 0.3) * 10 + (sleepy ? 12 : 0);
    }
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 5);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 5);

    squashV += (-160 * squash - 9 * squashV) * dt;
    squash += squashV * dt;
    kick *= Math.pow(0.02, dt);
    if (hop > 0 || hopV > 0) {
      hopV -= 900 * dt;
      hop += hopV * dt;
      if (hop <= 0) {
        hop = 0;
        squashV += 4;
        hopV = hopsLeft-- > 0 ? 150 + hopsLeft * 40 : 0;
      }
    }
    const breath = Math.sin(time * (sleepy ? 1.1 : 1.6)) * (sleepy ? 0.03 : 0.015);
    const sx = 1 + squash * 0.18 + breath;
    const sy = 1 - squash * 0.18 - breath * 0.6;

    ctx.clearRect(0, 0, w, h);
    const R = Math.min(58, h * 0.2);
    bodyR = R;
    const cx = w / 2;
    const cy = h / 2 + 14 + Math.sin(time * 1.6) * 3 * pace - hop;
    const top = cy - R * sy * 0.95;
    const dist = Math.hypot(ptr.x, ptr.y) || 1;
    const lean = { x: (ptr.x / dist) * Math.min(dist, 110), y: (ptr.y / dist) * Math.min(dist, 110) };
    const look = mood === "sleepy" ? { x: 0, y: 0.3 } : { x: (ptr.x / dist) * Math.min(1, dist / 120), y: (ptr.y / dist) * Math.min(1, dist / 120) };

    for (const n of nodes) {
      n.a += n.speed * dt * pace;
      const ox = Math.cos(n.a) * (n.r + kick) * 1.05;
      const oy = Math.sin(n.a) * (n.r + kick) * n.tilt;
      n.z = Math.sin(n.a);
      const px = cx + ox;
      const py = cy + oy;
      const dx = ptr.x + cx - px;
      const dy = ptr.y + cy - py;
      const d = Math.hypot(dx, dy);
      const pull = ptr.active && !sleepy ? Math.max(0, 1 - d / 140) * 18 : 0;
      n.x = px + (dx / (d || 1)) * pull;
      n.y = py + (dy / (d || 1)) * pull;
    }

    const drawWeb = (front) => {
      ctx.save();
      add();
      ctx.strokeStyle = COLORS.light ? COLORS.a : COLORS.b;
      ctx.lineWidth = 1;
      const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.z > 0 !== front) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK_DIST) continue;
          const bucket = buckets[Math.min(3, Math.floor((1 - d / LINK_DIST) * 4))];
          bucket.moveTo(a.x, a.y);
          bucket.lineTo(b.x, b.y);
        }
      }
      buckets.forEach((path, i) => {
        ctx.globalAlpha = ((i + 0.5) / 4) * (front ? 0.55 : 0.22) * (sleepy ? 0.6 : 1);
        ctx.stroke(path);
      });
      for (const n of nodes) {
        if (n.z > 0 !== front) continue;
        if (COLORS.light) {
          ctx.globalAlpha = front ? 0.9 : 0.4;
          ctx.fillStyle = COLORS.a;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.size * (front ? 0.9 : 0.7), 0, Math.PI * 2);
          ctx.fill();
        } else dot(n.x, n.y, n.size * (front ? 1 : 0.8), front ? 0.95 : 0.45);
      }
      ctx.restore();
    };

    drawWeb(false);
    if (COLORS.light) drawAngelWings(cx, cy, R);
    const crown = surfaceShift(-Math.PI / 2, lean, sx, sy);
    if (!COLORS.light) drawFlame(cx + crown.x, top + crown.y);

    const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.9);
    halo.addColorStop(0, COLORS.a + (COLORS.light ? "40" : "66"));
    halo.addColorStop(1, COLORS.a + "00");
    ctx.globalAlpha = 1;
    ctx.fillStyle = halo;
    ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    blobPath(cx, cy, R, sx, sy, lean);
    ctx.fillStyle = bodyGradient(cx, cy, R);
    ctx.fill();
    const hl = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 1, cx - R * 0.4, cy - R * 0.5, R * 0.55);
    hl.addColorStop(0, "rgba(255,255,255,0.55)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fill();

    if (COLORS.light) drawHalo(cx + look.x * 2, top + crown.y, R, Math.sin(time * 2) * 2.5 * pace);

    moodBlink = Math.max(0, moodBlink - dt);
    blinkAt -= dt;
    if (blinkAt < -0.12) blinkAt = 2.5 + Math.random() * 3;
    nextWink -= dt;
    if (mood === "look" && nextWink < 0) {
      winkUntil = time + 0.35;
      nextWink = 10 + Math.random() * 12;
    }
    const blink = blinkAt < 0 || moodBlink > 0;
    drawFace(cx, cy, R, look, blink, mood === "giggle" || ptr.over || COLORS.light);

    drawWeb(true);
    ctx.save();
    add();
    ctx.strokeStyle = COLORS.light ? COLORS.a : COLORS.b;
    ctx.lineWidth = 1;
    const synapses = new Path2D();
    for (const n of nodes) {
      const d = Math.hypot(n.x - cx, n.y - cy);
      if (n.z <= 0 || d > R + 34) continue;
      const t = R / d;
      synapses.moveTo(cx + (n.x - cx) * t, cy + (n.y - cy) * t);
      synapses.lineTo(n.x, n.y);
    }
    ctx.globalAlpha = 0.3;
    ctx.stroke(synapses);
    if (!sleepy && pulses.length < 3 && Math.random() < dt * 1.4) {
      const from = Math.floor(Math.random() * nodes.length);
      let to = -1;
      let best = LINK_DIST;
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - nodes[from].x, n.y - nodes[from].y);
        if (i !== from && d < best) {
          best = d;
          to = i;
        }
      });
      if (to >= 0) pulses.push({ from, to, t: 0 });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt * 1.6;
      if (p.t >= 1) {
        pulses.splice(i, 1);
        continue;
      }
      const a = nodes[p.from];
      const b = nodes[p.to];
      dot(a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t, 2, Math.sin(p.t * Math.PI));
    }
    ctx.restore();

    if (!reduced && !COLORS.light) {
      emberClock -= dt;
      if (emberClock < 0) {
        emberClock = sleepy ? 0.6 : 0.16;
        particles.push({ kind: "ember", x: (Math.random() - 0.5) * 14, y: top - cy - 16, vx: (Math.random() - 0.5) * 16, vy: -28 - Math.random() * 24, life: 0, max: 0.9 + Math.random() * 0.7 });
      }
    }
    if (sleepy) {
      zClock -= dt;
      if (zClock < 0) {
        zClock = 1.3;
        particles.push({ kind: "z", x: R * 0.7, y: -R * 0.8, vx: 10, vy: -16, life: 0, max: 2.4 });
      }
    }
    drawParticles(cx, cy, dt);
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  let raf = 0;
  let running = false;
  let visible = false;

  const frame = (now) => {
    const asleep = (now - ptr.lastMove) / 1000 > SLEEP_AFTER && giggleUntil <= time;
    const interacting = now - ptr.lastMove < LOOK_FOR * 1000 || giggleUntil > time || surprisedUntil > time || hop > 0;
    const minGap = 1000 / (asleep ? 15 : interacting ? 60 : 30);
    if (now - last >= minGap - 1) {
      draw(Math.min((now - last) / 1000, 0.08));
      last = now;
    }
    if (visible && !document.hidden && !reduced) raf = requestAnimationFrame(frame);
    else running = false;
  };

  function wake() {
    if (running || !visible || document.hidden || reduced) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  });
  io.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => {
    resize();
    if (reduced || !running) draw(0);
  }).observe(canvas);

  const restyle = () => {
    readColors();
    draw(0);
  };
  readColors();
  draw(0.016);
  return { cheer, giggle, restyle };
}
