/* Bot Rm — خريطة المواقع الحيّة (Canvas): كل المواقع نقاط، الرادار يمسحها، والموقع المطلوب يُكبَّر عليه مع نبضات */
(function () {
  'use strict';
  var cv, cx, W = 0, H = 0, DPR = 1, pts = [], bounds, cam = { x: 0, y: 0, k: 1 }, tgt = { x: 0, y: 0, k: 1 };
  var sel = null, pingT = -1, raf = 0, t0 = 0, col = {}, reduce = false, inited = false;
  var IQ = function (lo, la) { return lo > 38 && lo < 49.5 && la > 28.5 && la < 37.5; };

  function colors() {
    var s = getComputedStyle(document.documentElement);
    var g = function (n, d) { return (s.getPropertyValue(n) || d).trim() || d; };
    col = { dot: g('--mapdot', '#4fb7cf'), hi: g('--maphi', '#7fe6fb'), acc: g('--acc', '#3cc3df'), grid: g('--mapgrid', 'rgba(120,200,220,.08)') };
  }
  function proj(lo, la) { return { x: (lo - bounds.lo0) * bounds.c, y: -(la - bounds.la0) }; }
  function setup(rows) {
    pts = [];
    var los = [], las = [];
    rows.forEach(function (r) {
      var lo = +r.lon, la = +r.lat;
      if (!lo || !la || !IQ(lo, la)) return;
      pts.push({ id: r.id, lo: lo, la: la }); los.push(lo); las.push(la);
    });
    if (!pts.length) return;
    los.sort(function (a, b) { return a - b; }); las.sort(function (a, b) { return a - b; });
    var q = function (a, p) { return a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))]; };
    var lo0 = q(los, .01), lo1 = q(los, .99), la0 = q(las, .01), la1 = q(las, .99);
    bounds = { lo0: lo0, la0: (la0 + la1) / 2, c: Math.cos(((la0 + la1) / 2) * Math.PI / 180) };
    bounds.w = (lo1 - lo0) * bounds.c; bounds.h = la1 - la0; bounds.mx = (lo0 + lo1) / 2; bounds.my = (la0 + la1) / 2;
    pts.forEach(function (p) { var o = proj(p.lo, p.la); p.x = o.x; p.y = o.y; p.ph = Math.random() * 6.28; });
    overview();
  }
  function overview() {
    if (!bounds) return;
    var o = proj(bounds.mx, bounds.my);
    var k = Math.min(W / (bounds.w * 1.08), H / (bounds.h * 1.1));
    tgt = { x: o.x, y: o.y, k: k || 1 };
  }
  function resize() {
    if (!cv) return;
    var r = cv.parentNode.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    if (sel) focusOn(sel); else overview();
    if (!raf) frame(performance.now());
  }
  function focusOn(s) {
    var o = proj(s.lo, s.la);
    var base = Math.min(W / (bounds.w * 1.08), H / (bounds.h * 1.1));
    tgt = { x: o.x, y: o.y, k: base * 5.2 };
  }
  function sx(x) { return (x - cam.x) * cam.k + W / 2; }
  function sy(y) { return (y - cam.y) * cam.k + H / 2; }

  function frame(now) {
    raf = 0;
    if (!cx || !bounds) return;
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    var e = reduce ? 1 : .09;
    cam.x += (tgt.x - cam.x) * e; cam.y += (tgt.y - cam.y) * e; cam.k += (tgt.k - cam.k) * e;
    var moving = Math.abs(tgt.k - cam.k) > tgt.k * .002 || Math.abs(tgt.x - cam.x) > .0004;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.clearRect(0, 0, W, H);
    // شبكة خفيفة
    cx.strokeStyle = col.grid; cx.lineWidth = 1; cx.beginPath();
    var gs = 36, gx = (W / 2) % gs, gy = (H / 2) % gs;
    for (var x = gx; x < W; x += gs) { cx.moveTo(x, 0); cx.lineTo(x, H); }
    for (var y = gy; y < H; y += gs) { cx.moveTo(0, y); cx.lineTo(W, y); }
    cx.stroke();
    // مركز الرادار
    var ang = (t * .55) % 6.2832, rc = { x: W / 2, y: H / 2 };
    var overviewMode = !sel;
    // النقاط
    cx.fillStyle = col.dot;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], X = sx(p.x), Y = sy(p.y);
      if (X < -6 || X > W + 6 || Y < -6 || Y > H + 6) continue;
      var a = .38, r = cam.k > 40 ? 1.8 : 1.25;
      if (overviewMode && !reduce) {
        var d = (ang - Math.atan2(Y - rc.y, X - rc.x) + 12.566) % 6.2832;
        if (d < 1.2) a += (1 - d / 1.2) * .6;
      } else if (!reduce) { a += .1 * Math.sin(t * 1.6 + p.ph); }
      cx.globalAlpha = Math.min(1, a);
      cx.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    cx.globalAlpha = 1;
    if (overviewMode && !reduce) {
      var R = Math.max(W, H) * .6, g = cx.createConicGradient ? cx.createConicGradient(ang - 1.2, rc.x, rc.y) : null;
      if (g) { g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.19, col.acc.charAt(0) === '#' ? hexA(col.acc, .16) : 'rgba(60,195,223,.16)'); g.addColorStop(.1915, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(rc.x, rc.y, R, 0, 6.2832); cx.fill(); }
      cx.strokeStyle = hexA(col.acc, .5); cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(rc.x, rc.y); cx.lineTo(rc.x + Math.cos(ang) * R, rc.y + Math.sin(ang) * R); cx.stroke();
      cx.strokeStyle = hexA(col.acc, .12); cx.lineWidth = 1;
      for (var q = 1; q <= 3; q++) { cx.beginPath(); cx.arc(rc.x, rc.y, Math.min(W, H) * .17 * q, 0, 6.2832); cx.stroke(); }
    }
    // الموقع المحدد
    if (sel) {
      var X0 = sx(proj(sel.lo, sel.la).x), Y0 = sy(proj(sel.lo, sel.la).y);
      // الجيران الأقرب
      var tt = reduce ? 0 : t;
      var rg = cx.createRadialGradient(X0, Y0, 0, X0, Y0, 70);
      rg.addColorStop(0, hexA(col.hi, .45)); rg.addColorStop(1, hexA(col.hi, 0));
      cx.fillStyle = rg; cx.fillRect(X0 - 70, Y0 - 70, 140, 140);
      if (!reduce) {
        for (var k = 0; k < 3; k++) {
          var ph = ((tt * .55) + k / 3) % 1;
          cx.strokeStyle = hexA(col.hi, (1 - ph) * .75); cx.lineWidth = 1.6;
          cx.beginPath(); cx.arc(X0, Y0, 6 + ph * 58, 0, 6.2832); cx.stroke();
        }
        if (pingT >= 0) {
          var pp = (now - pingT) / 1100;
          if (pp < 1) { cx.strokeStyle = hexA(col.hi, (1 - pp)); cx.lineWidth = 2.4; cx.beginPath(); cx.arc(X0, Y0, 8 + pp * Math.max(W, H) * .6, 0, 6.2832); cx.stroke(); } else pingT = -1;
        }
      }
      tower(X0, Y0);
    }
    if (!reduce || moving) raf = requestAnimationFrame(frame);
  }
  function hexA(c, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return c;
    var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function tower(X, Y) {
    cx.save(); cx.translate(X, Y); cx.strokeStyle = col.hi; cx.fillStyle = col.hi; cx.lineWidth = 1.8; cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(-8, 4); cx.lineTo(0, -16); cx.lineTo(8, 4); cx.moveTo(-5.5, -3); cx.lineTo(5.5, -3); cx.moveTo(-8, 4); cx.lineTo(5.5, -3); cx.moveTo(8, 4); cx.lineTo(-5.5, -3); cx.stroke();
    cx.beginPath(); cx.arc(0, -18, 2.4, 0, 6.2832); cx.fill(); cx.restore();
  }

  window.SiteMap = {
    init: function (rows) {
      cv = document.getElementById('map'); if (!cv) return;
      cx = cv.getContext('2d'); reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      colors(); setup(rows);
      if (!inited) {
        inited = true;
        window.addEventListener('resize', resize);
        try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { colors(); }); } catch (e) {}
        if (window.ResizeObserver) new ResizeObserver(resize).observe(cv.parentNode);
        document.addEventListener('visibilitychange', function () { if (!document.hidden && !raf) frame(performance.now()); });
      }
      resize();
      var s = tgt; cam = { x: s.x, y: s.y, k: s.k * .7 }; // دخول تدريجي
      if (!raf) frame(performance.now());
    },
    update: function (rows) { setup(rows); if (sel) sel = null; if (!raf) frame(performance.now()); },
    focus: function (r) {
      var lo = +r.lon, la = +r.lat;
      if (!bounds || !lo || !la || !IQ(lo, la)) { this.reset(); return; }
      sel = { lo: lo, la: la, id: r.id }; focusOn(sel); pingT = performance.now(); if (!raf) frame(performance.now());
    },
    ping: function () { pingT = performance.now(); if (!raf) frame(performance.now()); },
    reset: function () { sel = null; overview(); if (!raf) frame(performance.now()); },
    resize: resize, recolor: colors
  };
})();
