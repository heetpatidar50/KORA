/* =========================================================
   KORA field: the hero's living farm, drawn on two canvases.
   - one wind field drives everything: steady breeze + rolling waves + gusts
     that travel across the field, so crops, mist, pollen and smoke move together
   - every stalk is a damped spring: it lags, overshoots and settles like a
     real stem; stems bend along their length, ears nod, leaves flutter
   - crops part around the pointer (mouse or finger)
   - the tubewell pours a wobbling column of water with streaks, droplets,
     splashes, foam and ripples; the tank spills into a channel whose water
     carries moving glints
   - over the photo: a flock that flaps and glides, mist drifting off the
     sprinklers, pollen lifting off the crops; the photo sinks a little as the
     page scrolls (parallax)
   Runs only while the hero is on screen; one still frame for reduced motion.
   ========================================================= */
(function () {
  "use strict";
  var hero = document.getElementById("hero");
  var ground = hero && hero.querySelector(".hero__ground");
  if (!hero || !ground || !document.createElement("canvas").getContext) return;
  var well = ground.querySelector("[data-tubewell]");
  var photo = hero.querySelector(".hero__bg");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2, EXTRA = 90;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function mix(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * k), g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k), bl = (pa & 255) + (((pb & 255) - (pa & 255)) * k);
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
  }
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  /* ---------- the two canvases ---------- */
  var fieldCv = document.createElement("canvas"); fieldCv.className = "field-canvas"; fieldCv.setAttribute("aria-hidden", "true");
  ground.appendChild(fieldCv);
  var skyCv = document.createElement("canvas"); skyCv.className = "sky-canvas"; skyCv.setAttribute("aria-hidden", "true");
  var overlay = hero.querySelector(".hero__overlay");
  hero.insertBefore(skyCv, overlay ? overlay.nextSibling : hero.firstChild);
  var fx = fieldCv.getContext("2d"), sx = skyCv.getContext("2d");

  /* ---------- sprites (drawn once, stamped every frame) ---------- */
  var SS = 3; // sprite supersampling
  function earSprite(fill, edge) {
    var w = 22, h = 58, c = canvas(w * SS, h * SS), g = c.getContext("2d");
    g.scale(SS, SS); g.lineCap = "round";
    g.strokeStyle = edge; g.lineWidth = 0.9; g.beginPath(); g.moveTo(11, 57); g.lineTo(11, 9); g.stroke();
    for (var i = 0; i < 8; i++) {
      var y = 52 - i * 5.4, sc = 1 - i * 0.045;
      [[-1, 0], [1, -2.6]].forEach(function (sd) {
        var cx = 11 + sd[0] * 2.3 * sc, cy = y + sd[1];
        g.save(); g.translate(cx, cy); g.rotate(sd[0] * 0.38);
        var gr = g.createLinearGradient(0, -4, 0, 4); gr.addColorStop(0, "#f6dc8a"); gr.addColorStop(0.45, fill); gr.addColorStop(1, edge);
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 2.5 * sc, 4.1 * sc, 0, 0, TAU); g.fill();
        g.strokeStyle = "rgba(120,86,20,.45)"; g.lineWidth = 0.45; g.stroke();
        g.restore();
        g.strokeStyle = "rgba(226,196,110,.85)"; g.lineWidth = 0.45; g.beginPath(); g.moveTo(cx + sd[0] * 1.4, cy - 3); g.lineTo(cx + sd[0] * (4 + i * 0.25), cy - 12 - i * 0.6); g.stroke();
      });
    }
    g.strokeStyle = "rgba(226,196,110,.9)"; g.lineWidth = 0.5; g.beginPath(); g.moveTo(11, 9); g.lineTo(11, 0); g.moveTo(11, 10); g.lineTo(8, 1); g.moveTo(11, 10); g.lineTo(14, 1); g.stroke();
    return { c: c, w: w, h: h };
  }
  function flowerSprite() {
    var w = 24, h = 22, c = canvas(w * SS, h * SS), g = c.getContext("2d"); g.scale(SS, SS);
    var pts = [[12, 14, 3.2], [8, 11, 2.6], [16, 11, 2.6], [12, 8, 2.7], [6, 15, 2.2], [18, 15, 2.2], [9, 5, 2], [15, 5, 2], [12, 2.5, 1.6]];
    pts.forEach(function (p) {
      var gr = g.createRadialGradient(p[0] - p[2] * 0.3, p[1] - p[2] * 0.3, 0.2, p[0], p[1], p[2]);
      gr.addColorStop(0, "#fff3a6"); gr.addColorStop(0.55, "#f4cf2c"); gr.addColorStop(1, "#d9a812");
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill();
    });
    g.fillStyle = "#86ad4a"; [[12, 19], [10, 20.5], [14, 20.5]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 1, 1.6, 0, 0, TAU); g.fill(); });
    return { c: c, w: w, h: h };
  }
  function tasselSprite() {
    var w = 20, h = 26, c = canvas(w * SS, h * SS), g = c.getContext("2d"); g.scale(SS, SS); g.lineCap = "round";
    g.strokeStyle = "#d8c56e"; g.lineWidth = 1.1;
    [[10, 26, 10, 2], [10, 20, 3, 7], [10, 18, 17, 6], [10, 22, 5, 12], [10, 22, 15, 12]].forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); g.quadraticCurveTo((l[0] + l[2]) / 2, l[3] + 2, l[2], l[3]); g.stroke(); });
    return { c: c, w: w, h: h };
  }
  function puffSprite(rgb) {
    var s = 64, c = canvas(s, s), g = c.getContext("2d"), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(" + rgb + ",1)"); gr.addColorStop(0.4, "rgba(" + rgb + ",.55)"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
  }
  var EARS = [earSprite("#e2b84b", "#a8821c"), earSprite("#d6a83a", "#97721a"), earSprite("#ebc965", "#b38b24")];
  var FLOWER = flowerSprite(), TASSEL = tasselSprite();
  var PUFF_W = puffSprite("255,255,255"), PUFF_G = puffSprite("232,232,228"), MOTE = puffSprite("255,244,200");

  /* ---------- the land: two cubic segments, x is linear in t ---------- */
  function bez(a, b, c, d, t) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  function crestVb(x) { return x <= 720 ? bez(52, 80, 28, 40, clamp(x / 720, 0, 1)) : bez(40, 52, 74, 44, clamp((x - 720) / 720, 0, 1)); }
  var W = 0, CH = 0, landH = 120, small = false, dpr = 1, HW = 0, HH = 0, SH = 0, sdpr = 1, photoY = -1;
  function crest(x) { return CH - landH + crestVb(x * 1440 / W) * landH / 120; }
  function chan(x) { return crest(x) + 15 * landH / 120; }

  /* ---------- the wind (positive leans right) ---------- */
  var gustPeriod = 9;
  function wind(x, t) {
    var gx = ((t % gustPeriod) / gustPeriod) * (W + 900) - 450, gd = (x - gx) / 190;
    return 0.26 + 0.3 * Math.sin(x * 0.0052 - t * 1.1) + 0.17 * Math.sin(x * 0.0137 - t * 1.85 + 1.3) + 0.07 * Math.sin(x * 0.043 - t * 3.3) + 0.95 * Math.exp(-gd * gd);
  }

  /* ---------- state ---------- */
  var stalks = [], fringe = [], glints = [], streaks = [], drops = [], splashes = [], ripples = [], smoke = [], spillDrops = [];
  var mist = [], motes = [], flock = null, flockWait = 4;
  var wg = null, chEnd = 0, t = 0, last = 0, raf = 0, running = false, visible = true;
  var pointer = { x: -9999, y: -9999, on: false };

  function wp(vx, vy) { return { x: wg.x + vx * wg.s, y: wg.y + vy * wg.s }; }

  var PAL = {
    wheat: { stem: ["#b39537", "#a88b33", "#c2a447"], leaf: ["#8fa951", "#86a04a", "#9db45c"] },
    maize: { stem: ["#5e8d39", "#6a9a3f"], leaf: ["#6e9e40", "#7bac4a", "#5f8f36"] },
    mustard: { stem: ["#6f9a3e", "#7aa446"], leaf: ["#78a448", "#86b054"] }
  };
  var HAZE = "#c8d4c2";

  function layout() {
    W = ground.clientWidth; var Hg = ground.clientHeight;
    if (!W || !Hg) return false;
    small = W < 640; landH = W <= 640 ? 84 : 120; CH = Hg + EXTRA;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    fieldCv.style.height = CH + "px";
    fieldCv.width = Math.round(W * dpr); fieldCv.height = Math.round(CH * dpr);
    HW = hero.clientWidth; HH = hero.clientHeight;
    sdpr = Math.min(window.devicePixelRatio || 1, 1.25);
    SH = Math.round(HH * 0.64); skyCv.style.height = SH + "px";
    skyCv.width = Math.round(HW * sdpr); skyCv.height = Math.round(SH * sdpr);
    gustPeriod = (W + 900) / 250;

    // the tubewell stands on the land, its tank on the field line
    if (well) {
      var ww = well.getBoundingClientRect().width || (small ? 118 : 190), wh = ww * 170 / 190;
      var wx = W - ww - (small ? 6 : W * 0.06);
      var foot = crest(wx + ww * 0.5);
      var top = foot - wh * (166 / 170) + 3;
      well.style.left = wx + "px"; well.style.bottom = (CH - (top + wh)) + "px";
      wg = { x: wx, y: top, s: ww / 190, w: ww };
      chEnd = wx + 9 * wg.s;
    } else { wg = null; chEnd = W; }

    plant();
    var gap = small ? 4 : 3.4; fringe = [];
    for (var fxp = 0; fxp < W; fxp += gap) fringe.push({ x: fxp + rnd(-1, 1), h: rnd(2.5, 7) * (small ? 0.8 : 1), ph: rnd(0, TAU) });
    glints = []; for (var i = 0; i < (small ? 10 : 22); i++) glints.push(newGlint(rnd(0, chEnd)));
    streaks = []; for (var k = 0; k < 9; k++) streaks.push({ u: rnd(0, 1), off: rnd(-0.35, 0.35), sp: rnd(0.8, 1.2) });
    motes = []; for (var m = 0; m < (small ? 10 : 22); m++) motes.push(newMote(true));
    mist = []; drops = []; splashes = []; ripples = []; smoke = []; spillDrops = [];
    return true;
  }

  function plant() {
    stalks = [];
    var sc = small ? 0.62 : W < 1040 ? 0.82 : 1;
    var rows = [
      { back: true, gap: small ? 12 : 10.5, s: sc * 0.66, types: ["wheat", "wheat", "wheat", "wheat", "mustard"] },
      { back: false, gap: small ? 15 : 12, s: sc, types: ["wheat", "wheat", "wheat", "maize", "mustard", "wheat", "maize", "mustard"] }
    ];
    rows.forEach(function (row) {
      var x = rnd(0, row.gap);
      while (x < W + 6) {
        if (wg && x > wg.x - 10 && x < wg.x + wg.w + 4) { x = wg.x + wg.w + rnd(4, 10); continue; }
        var type = pick(row.types);
        var h = (type === "maize" ? rnd(92, 122) : type === "mustard" ? rnd(52, 72) : rnd(62, 90)) * row.s;
        var pal = PAL[type], k = type === "maize" ? rnd(38, 52) : rnd(26, 40);
        var stem = pick(pal.stem), leaf = pick(pal.leaf);
        if (row.back) { stem = mix(stem.charAt(0) === "#" ? stem : "#b39537", HAZE, 0.38); leaf = mix(leaf, HAZE, 0.42); }
        stalks.push({
          x: x, y: crest(x) + (row.back ? 1 : 3), h: h, type: type, back: row.back,
          k: k, c: 2 * Math.sqrt(k) * rnd(0.22, 0.34), b: 0, v: 0, ph: rnd(0, TAU), lean: rnd(-0.05, 0.05),
          flex: (type === "maize" ? 0.1 : type === "mustard" ? 0.19 : 0.16) * rnd(0.85, 1.15),
          stem: stem, leaf: leaf, ear: pick(EARS), w: (type === "maize" ? 2.4 : type === "mustard" ? 1.3 : 1.55) * row.s,
          side: Math.random() < 0.5 ? 1 : -1, alpha: row.back ? 0.88 : 1, cob: type === "maize" && Math.random() < 0.6
        });
        x += row.gap * rnd(0.6, 1.4);
      }
    });
  }

  function newGlint(x) { return { x: x, len: rnd(8, 22) * (small ? 0.8 : 1), sp: rnd(38, 70), tw: rnd(2, 5), ph: rnd(0, TAU) }; }
  /* pollen lifts off the crop heads, drifts with the wind and fades out above them */
  function newMote(anywhere) {
    var x = rnd(0, W), top = crest(x) - 70 * (landH / 120);
    return { x: x, y: anywhere ? rnd(top - 140, top) : top + rnd(-10, 20), r: rnd(0.9, 2.2), vy: -rnd(5, 12), ph: rnd(0, TAU), tw: rnd(1, 2.6), life: anywhere ? rnd(0, 4) : 0, span: rnd(5, 9) };
  }
  function spawnFlock() {
    var n = small ? 4 : (5 + (Math.random() * 4 | 0)), sc = small ? 0.75 : 1, list = [];
    var y0 = rnd(SH * 0.12, SH * (small ? 0.2 : 0.3));
    for (var i = 0; i < n; i++) list.push({ dx: i * rnd(16, 28) * sc + (i % 2) * 6, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * rnd(6, 11) * sc, ph: rnd(0, TAU), f: rnd(5.2, 6.6), g: rnd(0, TAU), s: rnd(0.8, 1.08) * sc });
    flock = { x: HW + 40, y0: y0, v: rnd(48, 66), birds: list };
  }

  /* ---------- update ---------- */
  function update(dt) {
    t += dt;
    var i, s;
    for (i = 0; i < stalks.length; i++) {
      s = stalks[i];
      var target = wind(s.x, t) * s.flex * (s.back ? 0.8 : 1) + s.lean;
      if (pointer.on) {
        var dx = s.x - pointer.x, dy = (s.y - s.h * 0.55) - pointer.y, d = Math.sqrt(dx * dx + dy * dy * 0.35);
        if (d < 140) target += (dx >= 0 ? 1 : -1) * 0.62 * Math.pow(1 - d / 140, 2);
      }
      var a = s.k * (target - s.b) - s.c * s.v;
      s.v += a * dt; s.b += s.v * dt;
    }
    // channel glints travel downstream (to the left)
    for (i = 0; i < glints.length; i++) { var gl = glints[i]; gl.x -= gl.sp * dt; if (gl.x < -gl.len) glints[i] = newGlint(chEnd + rnd(0, 20)); }
    if (wg) {
      var mouth = wp(50, 131), sfc = wp(49.5, 150.5), S = wg.s;
      for (i = 0; i < streaks.length; i++) { var st = streaks[i]; st.u += (0.8 + st.u * 2.4) * dt * st.sp * 1.6; if (st.u > 1) { st.u = 0; st.off = rnd(-0.35, 0.35); } }
      // splashes and foam where the column meets the tank
      var n = Math.random() < dt * 60 ? 2 : 1;
      for (i = 0; i < n; i++) if (splashes.length < 70) splashes.push({ x: sfc.x + rnd(-2, 2) * S, y: sfc.y, vx: rnd(-40, 40) * S, vy: -rnd(28, 88) * S, life: 0, max: rnd(0.3, 0.6), r: rnd(0.6, 1.5) * S });
      for (i = splashes.length - 1; i >= 0; i--) { var p = splashes[i]; p.life += dt; p.vy += 430 * S * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life > p.max || (p.vy > 0 && p.y > sfc.y + 1)) splashes.splice(i, 1); }
      // drops peel off the edge of the column now and then
      if (Math.random() < dt * 3) drops.push({ x: mouth.x + rnd(-2.5, 2.5) * S, y: mouth.y + rnd(2, 12) * S, vx: rnd(-14, 14) * S, vy: rnd(10, 30) * S, r: rnd(0.6, 1.2) * S });
      for (i = drops.length - 1; i >= 0; i--) { var dp = drops[i]; dp.vy += 430 * S * dt; dp.x += dp.vx * dt; dp.y += dp.vy * dt; if (dp.y > sfc.y) drops.splice(i, 1); }
      // ripples
      if (!update.rt || t - update.rt > 0.34) { update.rt = t; ripples.push({ r: 2 * S, a: 0.85 }); }
      for (i = ripples.length - 1; i >= 0; i--) { var rp = ripples[i]; rp.r += (34 * S - rp.r) * dt * 1.4; rp.a -= dt * 0.62; if (rp.a <= 0) ripples.splice(i, 1); }
      // spill drops from the tank lip into the channel
      if (Math.random() < dt * 5) { var lip = wp(9, 151); spillDrops.push({ x: lip.x, y: lip.y, vx: -rnd(10, 22) * S, vy: rnd(0, 10) * S, r: rnd(0.6, 1.1) * S }); }
      for (i = spillDrops.length - 1; i >= 0; i--) { var sd = spillDrops[i]; sd.vy += 400 * S * dt; sd.x += sd.vx * dt; sd.y += sd.vy * dt; if (sd.y > chan(sd.x)) spillDrops.splice(i, 1); }
      // exhaust smoke carried by the wind
      if (!update.st || t - update.st > 0.5) { update.st = t; var ch = wp(169.5, 49); smoke.push({ x: ch.x, y: ch.y, r: 3 * S, a: 0.32, vx: 0, vy: -rnd(13, 20) * S }); }
      for (i = smoke.length - 1; i >= 0; i--) { var sm = smoke[i]; sm.vx += (wind(sm.x, t) * 16 - sm.vx) * dt; sm.x += sm.vx * dt; sm.y += sm.vy * dt; sm.vy *= 0.985; sm.r += 9 * S * dt; sm.a -= dt * 0.11; if (sm.a <= 0) smoke.splice(i, 1); }
    }
    // sky
    for (i = 0; i < motes.length; i++) {
      var mo = motes[i]; mo.life += dt;
      mo.x += (wind(mo.x, t) * 22 - 4) * dt; mo.y += mo.vy * dt + Math.sin(t * 1.3 + mo.ph) * 5 * dt;
      if (mo.life > mo.span || mo.y < 4 || mo.x > W + 20 || mo.x < -20) motes[i] = newMote(false);
    }
    if (!small || HW > 0) {
      var mistN = small ? 0 : (Math.random() < dt * 3.2 ? 1 : 0);
      for (i = 0; i < mistN; i++) mist.push({ x: rnd(HW * 0.58, HW * 0.98), y: rnd(SH * 0.6, SH * 0.82), r: rnd(30, 64), a: 0, max: rnd(0.07, 0.13), life: 0, span: rnd(4, 6.5) });
      for (i = mist.length - 1; i >= 0; i--) {
        var ms = mist[i]; ms.life += dt; var k2 = ms.life / ms.span;
        ms.a = ms.max * Math.sin(Math.PI * clamp(k2, 0, 1)); ms.x += (wind(ms.x, t) * 18 + 4) * dt; ms.y -= 3 * dt; ms.r += 9 * dt;
        if (k2 >= 1) mist.splice(i, 1);
      }
    }
    flockWait -= dt;
    if (!flock && flockWait <= 0) spawnFlock();
    if (flock) { flock.x -= flock.v * dt; if (flock.x < -260) { flock = null; flockWait = rnd(10, 18); } }
  }

  /* ---------- drawing: the field ---------- */
  function quadPt(ax, ay, cx, cy, bx, by, u) { var v = 1 - u; return { x: v * v * ax + 2 * v * u * cx + u * u * bx, y: v * v * ay + 2 * v * u * cy + u * u * by }; }
  function quadTan(ax, ay, cx, cy, bx, by, u) { return { x: 2 * (1 - u) * (cx - ax) + 2 * u * (bx - cx), y: 2 * (1 - u) * (cy - ay) + 2 * u * (by - cy) }; }

  /* stalks are drawn in batches: all leaves of one colour in one fill, all stems of one
     colour and width in one stroke, then the heads stamped as sprites */
  var HEAD = [];
  function addLeaf(path, p, ang, L, wdt, droop) {
    var dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    var tx = p.x + dx * L, ty = p.y + dy * L + L * droop;
    var mx = p.x + dx * L * 0.5, my = p.y + dy * L * 0.5 + L * droop * 0.15;
    path.moveTo(p.x, p.y);
    path.quadraticCurveTo(mx + nx * wdt, my + ny * wdt, tx, ty);
    path.quadraticCurveTo(mx - nx * wdt * 0.6, my - ny * wdt * 0.6, p.x, p.y);
  }
  function drawRow(g, back) {
    var leaves = {}, stems = {}, heads = HEAD; heads.length = 0;
    for (var n = 0; n < stalks.length; n++) {
      var s = stalks[n]; if (s.back !== back) continue;
      var b = s.b, h = s.h;
      var tx = s.x + Math.sin(b) * h, ty = s.y - Math.cos(b) * h;
      var cx = s.x + Math.sin(b * 0.32) * h * 0.55, cy = s.y - h * 0.58;
      var flut = Math.sin(t * 2.4 + s.ph) * 0.12 + Math.sin(t * 5.1 + s.ph * 2) * 0.05;
      var lp = leaves[s.leaf] || (leaves[s.leaf] = new Path2D());
      var us = s.type === "maize" ? [0.22, 0.38, 0.54, 0.7] : s.type === "wheat" ? [0.3, 0.5] : [0.24];
      for (var i = 0; i < us.length; i++) {
        var u = us[i], p = quadPt(s.x, s.y, cx, cy, tx, ty, u), tg = quadTan(s.x, s.y, cx, cy, tx, ty, u);
        var ang = Math.atan2(tg.y, tg.x) + (i % 2 ? -1 : 1) * s.side * (s.type === "maize" ? 1.05 : 0.8) + b * 0.7 + flut * (1 + u);
        var L = h * (s.type === "maize" ? 0.46 - u * 0.12 : 0.3);
        addLeaf(lp, p, ang, L, L * (s.type === "maize" ? 0.13 : 0.085), s.type === "maize" ? 0.42 : 0.28);
      }
      var key = s.stem + "|" + s.w.toFixed(2), sp = stems[key] || (stems[key] = { p: new Path2D(), c: s.stem, w: s.w });
      sp.p.moveTo(s.x, s.y); sp.p.quadraticCurveTo(cx, cy, tx, ty);
      var end = quadTan(s.x, s.y, cx, cy, tx, ty, 1), ea = Math.atan2(end.y, end.x) + Math.PI / 2;
      if (s.type === "mustard") {
        var fp = quadPt(s.x, s.y, cx, cy, tx, ty, 0.66), fs = h * 0.34;
        for (var j = -1; j <= 1; j += 2) {
          var ba = ea - Math.PI / 2 + j * 0.55 + b * 0.4, bl = h * 0.22, bx2 = fp.x + Math.cos(ba) * bl, by2 = fp.y + Math.sin(ba) * bl;
          sp.p.moveTo(fp.x, fp.y); sp.p.lineTo(bx2, by2);
          heads.push(FLOWER, bx2, by2, 0, fs * 0.64, fs * 0.6, 0.5, 0.6);
        }
        heads.push(FLOWER, tx, ty, ea + b * 0.3, fs, fs * 0.92, 0.5, 0.93);
      } else if (s.type === "wheat") {
        var E = h * 0.3; heads.push(s.ear, tx, ty, ea + b * 0.55 + Math.sin(t * 3 + s.ph) * 0.03, E * s.ear.w / s.ear.h, E, 0.5, 1);
      } else {
        var T = h * 0.24; heads.push(TASSEL, tx, ty, ea + b * 0.4, T * 0.8, T, 0.5, 1);
        if (s.cob) { var cp = quadPt(s.x, s.y, cx, cy, tx, ty, 0.5); heads.push("cob", cp.x, cp.y, Math.atan2(quadTan(s.x, s.y, cx, cy, tx, ty, 0.5).y, quadTan(s.x, s.y, cx, cy, tx, ty, 0.5).x) + Math.PI / 2 + s.side * 0.45, h, s.side, 0, 0); }
      }
    }
    g.globalAlpha = back ? 0.88 : 1;
    for (var lc in leaves) { g.fillStyle = lc; g.fill(leaves[lc]); }
    g.lineCap = "round";
    for (var sk in stems) { g.strokeStyle = stems[sk].c; g.lineWidth = stems[sk].w; g.stroke(stems[sk].p); }
    for (var k = 0; k < heads.length; k += 8) {
      var spr = heads[k], x = heads[k + 1], y = heads[k + 2], a = heads[k + 3], co = Math.cos(a) * dpr, si = Math.sin(a) * dpr;
      g.setTransform(co, si, -si, co, x * dpr, y * dpr);
      if (spr === "cob") {
        var hh = heads[k + 4], sd = heads[k + 5];
        g.fillStyle = "#a9c25c"; g.beginPath(); g.ellipse(sd * hh * 0.035, -hh * 0.07, hh * 0.03, hh * 0.085, 0, 0, TAU); g.fill();
        g.fillStyle = "#ecd27a"; g.beginPath(); g.ellipse(sd * hh * 0.03, -hh * 0.1, hh * 0.018, hh * 0.05, 0, 0, TAU); g.fill();
      } else {
        var w = heads[k + 4], hgt = heads[k + 5];
        g.drawImage(spr.c, -w * heads[k + 6], -hgt * heads[k + 7], w, hgt);
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1;
  }

  function landPath(g) {
    g.beginPath(); g.moveTo(-2, crest(0));
    for (var x = 0; x <= W + 8; x += 8) g.lineTo(x, crest(Math.min(x, W)));
    g.lineTo(W + 2, CH + 2); g.lineTo(-2, CH + 2); g.closePath();
  }
  function curve(g, f, x0, x1, step) { g.beginPath(); g.moveTo(x0, f(x0)); for (var x = x0 + step; x < x1; x += step) g.lineTo(x, f(x)); g.lineTo(x1, f(x1)); }

  function drawField() {
    var g = fx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, CH);
    drawRow(g, true);
    // shade where the stems meet the soil, so the crops stand in the ground rather than on it
    g.lineJoin = "round"; g.lineCap = "butt";
    [[30, "rgba(58,66,34,.10)"], [16, "rgba(58,62,32,.14)"], [7, "rgba(52,50,28,.2)"]].forEach(function (b) { curve(g, crest, 0, W, 8); g.lineWidth = b[0] * (landH / 120); g.strokeStyle = b[1]; g.stroke(); });
    drawRow(g, false);

    // land, with a soil band that follows the field line
    landPath(g); g.fillStyle = "#f3efe6"; g.fill();
    g.save(); landPath(g); g.clip();
    g.lineJoin = "round";
    [[34, "rgba(196,170,128,.16)"], [20, "rgba(176,146,104,.2)"], [9, "rgba(150,118,80,.22)"]].forEach(function (b) { curve(g, crest, 0, W, 8); g.lineWidth = b[0]; g.strokeStyle = b[1]; g.stroke(); });
    g.restore();
    // a fringe of short grass along the field line, bending with the wind
    g.strokeStyle = "rgba(104,138,66,.7)"; g.lineWidth = 1; g.beginPath();
    for (var f = 0; f < fringe.length; f++) {
      var fr = fringe[f], yb = crest(fr.x) + 1.5, lean = wind(fr.x, t) * 2.2 + Math.sin(t * 3 + fr.ph) * 0.6;
      g.moveTo(fr.x, yb); g.quadraticCurveTo(fr.x + lean * 0.3, yb - fr.h * 0.6, fr.x + lean, yb - fr.h);
    }
    g.stroke();

    // the channel: banks, water, a moving surface, glints
    var sc = landH / 120;
    g.lineCap = "round"; g.lineJoin = "round";
    curve(g, chan, 0, chEnd, 6); g.lineWidth = 13 * sc; g.strokeStyle = "rgba(118,86,56,.2)"; g.stroke();
    g.lineWidth = 7.5 * sc; g.strokeStyle = "#64aec6"; g.stroke();
    g.lineWidth = 3.2 * sc; g.strokeStyle = "rgba(168,222,238,.9)"; g.save(); g.translate(0, -1.2 * sc); g.stroke(); g.restore();
    g.setLineDash([10 * sc, 24 * sc]); g.lineDashOffset = t * 46; g.lineWidth = 1.4 * sc; g.strokeStyle = "rgba(255,255,255,.4)"; g.stroke();
    g.setLineDash([4 * sc, 34 * sc]); g.lineDashOffset = t * 66 + 7; g.strokeStyle = "rgba(255,255,255,.55)"; g.stroke();
    g.setLineDash([]);
    g.lineWidth = 1.8 * sc;
    for (var gi = 0; gi < glints.length; gi++) {
      var gl = glints[gi]; if (gl.x > chEnd) continue;
      var tw = 0.35 + 0.55 * Math.abs(Math.sin(t * gl.tw + gl.ph));
      g.strokeStyle = "rgba(255,255,255," + tw.toFixed(2) + ")";
      curve(g, function (x) { return chan(x) - 1.3 * sc; }, Math.max(0, gl.x), Math.min(chEnd, gl.x + gl.len), 3); g.stroke();
    }

    if (wg) drawWater(g);
    for (var mi = 0; mi < motes.length; mi++) {
      var m = motes[mi], k = m.life / m.span, a = Math.sin(Math.PI * clamp(k, 0, 1)) * (0.4 + 0.4 * Math.abs(Math.sin(t * m.tw + m.ph)));
      g.globalAlpha = a; var r = m.r * 3; g.drawImage(MOTE, m.x - r, m.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  function drawWater(g) {
    var S = wg.s, mouth = wp(50, 131), sfc = wp(49.5, 150.5), lip = wp(9, 151.5);
    // spill from the tank lip down to the channel
    var cx0 = chEnd - 2 * S, cy0 = chan(cx0);
    g.lineCap = "round";
    g.beginPath(); g.moveTo(lip.x, lip.y); g.quadraticCurveTo(lip.x - 7 * S, lip.y + 1 * S, cx0, cy0);
    g.lineWidth = 3.4 * S; g.strokeStyle = "rgba(150,210,232,.9)"; g.stroke();
    g.setLineDash([3 * S, 6 * S]); g.lineDashOffset = -t * 40; g.lineWidth = 1.3 * S; g.strokeStyle = "rgba(255,255,255,.8)"; g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(220,245,255,.9)";
    spillDrops.forEach(function (d) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); });

    // the falling column: wobbling edges, brighter core
    var N = 12, left = [], right = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, y = mouth.y + (sfc.y - mouth.y) * u, x = mouth.x + (sfc.x - mouth.x) * u;
      var half = (6.2 * S * (1 - u * 0.22)) / 2, wob = Math.sin(u * 10 - t * 24) * 0.45 * S + Math.sin(u * 23 - t * 37) * 0.25 * S;
      left.push([x - half + wob, y]); right.push([x + half + wob * 0.7, y]);
    }
    var gr = g.createLinearGradient(mouth.x - 3.5 * S, 0, mouth.x + 3.5 * S, 0);
    gr.addColorStop(0, "rgba(124,192,220,.78)"); gr.addColorStop(0.5, "rgba(232,248,255,.96)"); gr.addColorStop(1, "rgba(118,186,214,.8)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(left[0][0], left[0][1]);
    for (i = 1; i <= N; i++) g.lineTo(left[i][0], left[i][1]);
    for (i = N; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath(); g.fill();
    // streaks running down the column, faster as they fall
    g.lineWidth = 0.9 * S; g.strokeStyle = "rgba(255,255,255,.85)";
    g.beginPath();
    streaks.forEach(function (st) {
      var y = mouth.y + (sfc.y - mouth.y) * st.u, L = (3 + st.u * 6) * S;
      if (y + L > sfc.y) return;
      var x = mouth.x + st.off * 6 * S;
      g.moveTo(x, y); g.lineTo(x, y + L);
    });
    g.stroke();
    g.fillStyle = "rgba(225,246,255,.92)";
    drops.forEach(function (d) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); });

    // ripples and a shimmer on the tank's water, kept inside the tank
    var w0 = wp(12, 149), w1 = wp(84, 158);
    g.save(); g.beginPath(); g.rect(w0.x, w0.y, w1.x - w0.x, w1.y - w0.y); g.clip();
    g.lineWidth = 1.1 * S;
    ripples.forEach(function (r) { g.strokeStyle = "rgba(255,255,255," + Math.max(0, r.a).toFixed(2) + ")"; g.beginPath(); g.ellipse(sfc.x, sfc.y + 0.5 * S, r.r, r.r * 0.22, 0, 0, TAU); g.stroke(); });
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1 * S; g.beginPath();
    for (var k = 0; k < 3; k++) { var hx = w0.x + ((t * 9 + k * 23 * S) % (w1.x - w0.x)); g.moveTo(hx, w0.y + 2.2 * S); g.lineTo(hx + 7 * S, w0.y + 2.2 * S); }
    g.stroke();
    g.restore();
    // foam and splashes at the point of impact
    for (var f = 0; f < 6; f++) {
      g.fillStyle = "rgba(255,255,255," + (0.45 + 0.3 * Math.sin(t * 19 + f)).toFixed(2) + ")";
      g.beginPath(); g.arc(sfc.x + Math.sin(t * 17 + f * 1.7) * 3.2 * S, sfc.y + Math.cos(t * 13 + f) * 0.8 * S, (1.2 + (f % 3) * 0.6) * S, 0, TAU); g.fill();
    }
    splashes.forEach(function (p) { g.fillStyle = "rgba(226,247,255," + (0.9 * (1 - p.life / p.max)).toFixed(2) + ")"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); });
    // exhaust
    smoke.forEach(function (sm) { g.globalAlpha = Math.max(0, sm.a); g.drawImage(PUFF_G, sm.x - sm.r, sm.y - sm.r, sm.r * 2, sm.r * 2); });
    g.globalAlpha = 1;
  }

  /* ---------- drawing: the sky ---------- */
  function drawSky() {
    var g = sx;
    g.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    g.clearRect(0, 0, HW, SH);
    mist.forEach(function (m) { g.globalAlpha = Math.max(0, m.a); g.drawImage(PUFF_W, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); });
    g.globalAlpha = 1;
    if (flock) {
      g.lineCap = "round"; g.lineJoin = "round";
      flock.birds.forEach(function (b) {
        var bx = flock.x + b.dx, by = flock.y0 + b.dy + Math.sin((flock.x + b.dx) * 0.012) * 9 + Math.sin(t * 1.4 + b.ph) * 2.2;
        // flap, then glide: the envelope eases between the two
        var env = 0.5 + 0.5 * Math.tanh(Math.sin(t * 0.85 + b.g) * 3), flap = Math.sin(t * b.f + b.ph) * (0.25 + 0.75 * env);
        var sp = 11 * b.s, tipY = by - sp * 0.5 * flap + sp * 0.08, midY = by - sp * 0.2 * flap - 1.2 * b.s;
        g.strokeStyle = "rgba(22,30,32,.78)"; g.lineWidth = 1.5 * b.s;
        g.beginPath(); g.moveTo(bx - sp, tipY); g.quadraticCurveTo(bx - sp * 0.45, midY, bx, by); g.quadraticCurveTo(bx + sp * 0.45, midY, bx + sp, tipY); g.stroke();
        g.fillStyle = "rgba(22,30,32,.8)"; g.beginPath(); g.ellipse(bx - 1 * b.s, by + 0.4 * b.s, 2.3 * b.s, 1 * b.s, 0, 0, TAU); g.fill();
      });
    }
  }

  /* ---------- the photo sinks a little as the page scrolls ---------- */
  function drawPhoto() {
    if (!photo) return;
    var y = Math.round(Math.min(window.scrollY || 0, HH) * 0.22 * 2) / 2;
    if (y === photoY) return; photoY = y;
    photo.style.transform = "translate3d(0," + y + "px,0) scale(1.06)";
  }

  /* ---------- the loop ---------- */
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    update(dt); drawField(); drawSky(); drawPhoto();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function still() { // one calm frame for reduced motion
    for (var i = 0; i < stalks.length; i++) stalks[i].b = 0.26 * stalks[i].flex + stalks[i].lean;
    flock = null; motes = []; drawField(); drawSky(); drawPhoto();
  }

  function init() {
    if (!layout()) return;
    if (reduce) { still(); return; }
    // let the field settle into the wind before the first frame shows
    for (var i = 0; i < 90; i++) update(1 / 60);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !document.hidden) start(); else stop(); }, { rootMargin: "60px 0px" }).observe(hero);
    } else start();
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else if (visible) start(); });
  }

  /* ---------- the pointer parts the crops ---------- */
  function onPointer(e) {
    var r = fieldCv.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    pointer.on = pointer.y > -40 && pointer.y < r.height + 20;
  }
  hero.addEventListener("pointermove", onPointer, { passive: true });
  hero.addEventListener("pointerdown", onPointer, { passive: true });
  hero.addEventListener("pointerleave", function () { pointer.on = false; });
  hero.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") pointer.on = false; });

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = ground.clientWidth; if (w === W && hero.clientHeight === HH) return; layout(); if (reduce) still(); }, 160);
  });
  if (document.readyState === "complete") init(); else window.addEventListener("load", init);
})();
