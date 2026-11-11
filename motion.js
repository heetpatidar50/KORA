/* =========================================================
   KORA motion (everything outside the hero's canvases, which js/field.js draws):
   staggered reveals, card tilt and the glass highlight, rising bubbles, rain in
   three depths with splashes, growing sprouts, the light that runs down the
   architecture flow, counting stats, the nav's light/dark switch, true glass
   refraction on Chromium desktops, and pausing whatever is off screen.
   No libraries.
   ========================================================= */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var phone = innerWidth < 640;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html) e.innerHTML = html; return e; }

  /* ---------- reveals: children of one grid arrive one after another ---------- */
  var seen = new Map();
  function staggerReveals() {
    document.querySelectorAll("[data-reveal]").forEach(function (n) {
      var p = n.parentElement, i = seen.get(p) || 0;
      n.style.setProperty("--rd", Math.min(i * 0.08, 0.48).toFixed(2) + "s");
      seen.set(p, i + 1);
      // once it has arrived, hand the element back to its own hover transitions
      n.addEventListener("transitionend", function done(e) {
        if (e.propertyName !== "transform" || !n.classList.contains("is-visible")) return;
        n.removeEventListener("transitionend", done);
        n.removeAttribute("data-reveal"); n.style.removeProperty("--rd");
      });
    });
  }
  // main.js adds data-reveal synchronously before us, so they are all there now
  staggerReveals();

  /* ---------- glass: the highlight follows the pointer, cards tilt toward it ---------- */
  var TILT = ".step, .node, .module, .mcard, .tcard, .role, .pcard, .stat, .pillar, .benefit, .hub__center, .operator__card, .problem";
  if (fine && !reduce) {
    document.querySelectorAll(TILT).forEach(function (c) { c.classList.add("tilt"); });
    var raf = 0, last = null, active = null;
    document.addEventListener("pointermove", function (e) {
      last = e; if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var tgt = last.target && last.target.closest ? last.target : null;
        var glass = tgt && tgt.closest(".glass, .nav");
        if (glass) {
          var r = glass.getBoundingClientRect();
          glass.style.setProperty("--mx", ((last.clientX - r.left) / r.width * 100).toFixed(1) + "%");
          glass.style.setProperty("--my", ((last.clientY - r.top) / r.height * 100).toFixed(1) + "%");
        }
        var card = tgt && tgt.closest(".tilt");
        if (active && active !== card) { active.classList.remove("is-tilting"); active = null; }
        if (card && !card.hasAttribute("data-reveal")) {
          var b = card.getBoundingClientRect(), px = (last.clientX - b.left) / b.width - 0.5, py = (last.clientY - b.top) / b.height - 0.5;
          var max = b.width > 420 ? 2 : 4;
          card.style.setProperty("--ry", (px * max * 2).toFixed(2) + "deg");
          card.style.setProperty("--rx", (-py * max * 2).toFixed(2) + "deg");
          card.classList.add("is-tilting"); active = card;
        }
      });
    }, { passive: true });
    document.addEventListener("pointerleave", function () { if (active) { active.classList.remove("is-tilting"); active = null; } });
  }

  /* ---------- true refraction on Chromium desktops (the SVG filter in the page) ---------- */
  var chromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some(function (b) { return /Chromium/.test(b.brand); }));
  if (chromium && fine && innerWidth >= 1024 && !reduce) document.documentElement.classList.add("lg-refract");

  /* ---------- the nav turns light over every dark band ---------- */
  var navWrap = document.querySelector(".nav-wrap"), darks = document.querySelectorAll(".hero, .section--deep, .section--impact, .cta, .footer");
  if (navWrap && darks.length) {
    var navTick = 0;
    var setNav = function () {
      navTick = 0;
      var y = 46, dark = false;
      for (var i = 0; i < darks.length; i++) { var r = darks[i].getBoundingClientRect(); if (r.top <= y && r.bottom > y) { dark = true; break; } }
      navWrap.classList.toggle("is-over-hero", dark);
    };
    setNav();
    window.addEventListener("scroll", function () { if (!navTick) navTick = requestAnimationFrame(setNav); }, { passive: true });
  }

  /* ---------- bubbles: each rises on one path and sways on another ---------- */
  document.querySelectorAll("[data-bubbles]").forEach(function (box) {
    if (reduce) return;
    for (var i = 0; i < (phone ? 10 : 20); i++) {
      var s = rnd(5, 22);
      box.appendChild(el("i", "left:" + rnd(0, 100).toFixed(1) + "%;--t:" + rnd(12, 24).toFixed(1) + "s;--dl:-" + rnd(0, 24).toFixed(1) + "s",
        '<b style="--s:' + s.toFixed(0) + "px;--x:" + rnd(6, 18).toFixed(0) + "px;--w:" + rnd(1.8, 3.2).toFixed(2) + 's"></b>'));
    }
  });

  /* ---------- rain in three depths, rings and splashes where it lands ---------- */
  var rain = document.querySelector("[data-rain]");
  if (rain && !reduce) {
    var depths = [
      { n: phone ? 14 : 30, w: 1, l: [22, 34], t: [1.4, 1.9], o: 0.35 },
      { n: phone ? 10 : 22, w: 1.4, l: [36, 52], t: [0.95, 1.25], o: 0.6 },
      { n: phone ? 5 : 10, w: 2, l: [56, 78], t: [0.7, 0.9], o: 0.8 }
    ];
    depths.forEach(function (d) {
      for (var i = 0; i < d.n; i++) {
        var tt = rnd(d.t[0], d.t[1]);
        rain.appendChild(el("i", "left:" + rnd(0, 128).toFixed(1) + "%;--w:" + d.w + "px;--l:" + rnd(d.l[0], d.l[1]).toFixed(0) + "px;--o:" + d.o + ";--t:" + tt.toFixed(2) + "s;--dl:-" + rnd(0, tt).toFixed(2) + "s"));
      }
    });
  }
  var rings = document.querySelector("[data-rings]");
  if (rings && !reduce) {
    for (var r = 0; r < (phone ? 5 : 10); r++) {
      var left = rnd(3, 97).toFixed(1), dl = rnd(0, 2.8).toFixed(2);
      rings.appendChild(el("i", "left:" + left + "%;--dl:-" + dl + "s"));
      for (var k = -1; k <= 1; k++) rings.appendChild(el("s", "left:calc(" + left + "% + " + (k * 4) + "px);--r:" + (k * 28) + "deg;--dl:-" + dl + "s"));
    }
  }

  /* ---------- sprouts grow (from the middle out), unfurl, then sway ---------- */
  var sproutBox = document.querySelector("[data-sprouts]");
  /* a seedling: a stem with a slight lean, two seed leaves and a first true leaf, each
     with a lighter midrib; every one a little different */
  function sproutSvg(j) {
    var lean = rnd(-3, 3), top = 30 + lean;
    return '<svg viewBox="0 0 60 100" preserveAspectRatio="xMidYMax meet">' +
      '<path class="stem" d="M30 100 C30 80 ' + (29 - lean * 0.4).toFixed(1) + ' 60 ' + top.toFixed(1) + ' 40"/>' +
      '<g class="leaf leaf--l"><path d="M' + (top - 0.5).toFixed(1) + ' 53 C20 54 8 49 3 39 C14 35 26 41 ' + (top - 0.5).toFixed(1) + ' 51Z"/><path class="rib" d="M' + (top - 1).toFixed(1) + ' 52 C20 49 11 45 6 40"/></g>' +
      '<g class="leaf leaf--r"><path d="M' + (top + 0.5).toFixed(1) + ' 46 C40 46 52 39 57 28 C46 25 35 32 ' + (top + 0.5).toFixed(1) + ' 44Z"/><path class="rib" d="M' + (top + 1).toFixed(1) + ' 45 C40 42 49 35 54 29"/></g>' +
      '<g class="leaf leaf--t"><path d="M' + top.toFixed(1) + ' 41 C' + (top - 6).toFixed(1) + ' 33 ' + (top - 5).toFixed(1) + ' 21 ' + (top + 1).toFixed(1) + ' 12 C' + (top + 6).toFixed(1) + ' 22 ' + (top + 5).toFixed(1) + ' 33 ' + top.toFixed(1) + ' 41Z"/><path class="rib" d="M' + top.toFixed(1) + ' 39 C' + (top - 1).toFixed(1) + ' 31 ' + top.toFixed(1) + ' 22 ' + (top + 1).toFixed(1) + ' 15"/></g>' +
      '</svg>';
  }
  if (sproutBox) {
    var count = phone ? 9 : 18, mid = (count - 1) / 2;
    for (var j = 0; j < count; j++) {
      var sp = el("span", "--h:" + rnd(52, 104).toFixed(0) + "px;--dl:" + (Math.abs(j - mid) * 0.09).toFixed(2) + "s;--d:" + rnd(3.6, 5.2).toFixed(2) + "s;--sd:-" + rnd(0, 4).toFixed(2) + "s;--a:" + rnd(2, 4).toFixed(1) + "deg",
        sproutSvg(j));
      sp.className = "sprout";
      sproutBox.appendChild(sp);
    }
    var grow = function () { sproutBox.classList.add("is-grown"); };
    if (reduce) sproutBox.classList.add("is-grown");
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es, io) { es.forEach(function (e) { if (e.isIntersecting) { grow(); io.disconnect(); } }); }, { threshold: 0.3 }).observe(sproutBox);
    } else grow();
  }

  /* ---------- architecture: a droplet of light runs down the flow ---------- */
  var flow = document.querySelector(".flow");
  if (flow && !reduce) {
    var track = el("span"); track.className = "flow__track"; track.setAttribute("aria-hidden", "true");
    var drop = el("span"); drop.className = "flow__drop"; track.appendChild(drop);
    flow.insertBefore(track, flow.firstChild);
  }

  /* ---------- stats count up once, in the number's own format ---------- */
  var nums = document.querySelectorAll(".stat__num:not(.stat__num--ai), .problem__big");
  function countUp(n) {
    var text = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild : null; if (!text) return;
    var raw = text.nodeValue.trim(), m = raw.match(/^(~?)([\d,]+(?:\.\d+)?)$/); if (!m) return;
    var target = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length, comma = m[2].indexOf(",") >= 0, t0 = null;
    function fmt(v) { var s = v.toFixed(dec); if (comma) s = Number(s).toLocaleString("en-IN"); return m[1] + s; }
    function tick(ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 1600), e = 1 - Math.pow(1 - k, 4); text.nodeValue = fmt(target * e); if (k < 1) requestAnimationFrame(tick); else text.nodeValue = raw; }
    requestAnimationFrame(tick);
  }
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } }); }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------- pause every animated part that is off screen ---------- */
  if ("IntersectionObserver" in window) {
    var po = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle("is-paused", !e.isIntersecting); }); }, { rootMargin: "120px 0px" });
    document.querySelectorAll(".hero, .section, .cta").forEach(function (s) { po.observe(s); });
  }
  document.addEventListener("visibilitychange", function () { document.documentElement.classList.toggle("is-paused", document.hidden); });

  /* ---------- the water light behind the page rests while the hero covers the whole screen ----------
     (it can't be seen then, and leaving it out of the frame lets the hero's canvases have the GPU) */
  var aqua = document.querySelector(".aqua"), heroEl = document.querySelector(".hero");
  if (aqua && heroEl) {
    var aquaQueued = false;
    var aquaCheck = function () {
      aquaQueued = false;
      var covered = heroEl.getBoundingClientRect().bottom >= window.innerHeight - 2 && window.scrollY < heroEl.offsetHeight;
      aqua.classList.toggle("is-covered", covered);
    };
    var aquaQueue = function () { if (!aquaQueued) { aquaQueued = true; requestAnimationFrame(aquaCheck); } };
    window.addEventListener("scroll", aquaQueue, { passive: true });
    window.addEventListener("resize", aquaQueue);
    aquaCheck();
  }
})();
