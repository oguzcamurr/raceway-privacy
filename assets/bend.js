/* Raceway free calculators: shared conduit-bending math and small UI helpers.
   Runs entirely in the browser (and in Node for tests: node --test tests/). It makes no network requests.
   Point model: every bend is a sharp corner, the model behind apprenticeship multiplier and shrink charts.
   Marks are measured from the conduit end you hook your tape on (same convention as the offset calculator). */
(function (root) {
  "use strict";
  var RB = {};
  RB.ANGLES = [10, 22.5, 30, 45, 60];
  /* Rounded multipliers and shrink-per-inch printed on many benders and trade charts. */
  RB.FIELD_MULT = { 10: 6, 22.5: 2.6, 30: 2, 45: 1.4, 60: 1.2 };
  RB.FIELD_SHRINK = { 10: 1 / 16, 22.5: 3 / 16, 30: 1 / 4, 45: 3 / 8, 60: 1 / 2 };
  /* 3-point saddle with a 45° center and 22.5° outer bends: the common field rule. */
  RB.SADDLE3_FIELD = { mult: 2.5, shrink: 3 / 16 };
  /* 90° take-up (deduct) printed on common EMT hand benders, e.g. Greenlee Site-Rite 840-843 and Klein
     51604-51607. Other benders differ: always use the number on your own bender. */
  RB.TAKE_UP = [
    { size: "1/2\" EMT", inches: 5 },
    { size: "3/4\" EMT", inches: 6 },
    { size: "1\" EMT", inches: 8 },
    { size: "1-1/4\" EMT", inches: 11 }
  ];

  function rad(d) { return d * Math.PI / 180; }
  RB.rad = rad;

  /* parse, frac and num are the same as on the conduit offset calculator page. */
  RB.parse = function (v) {
    v = String(v || "").trim().replace(/["”]/g, "").replace(/-/g, " "); if (!v) return null;
    var m = v.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?$/); if (!m || (!m[1] && !m[2])) return NaN;
    var n = m[1] ? parseFloat(m[1]) : 0; if (m[2]) { if (+m[3] === 0) return NaN; n += m[2] / m[3]; } return n;
  };
  RB.frac = function (x, den) {
    var neg = x < 0; x = Math.abs(x); var t = Math.round(x * den), w = Math.floor(t / den), r = t % den;
    if (r) { var g = function (a, b) { return b ? g(b, a % b) : a; }, k = g(r, den); r /= k; var d = den / k; return (neg ? "−" : "") + (w ? w + " " : "") + r + "/" + d + "\""; }
    return (neg ? "−" : "") + w + "\"";
  };
  RB.num = function (x) { return (Math.round(x * 1000) / 1000).toFixed(3); };

  RB.exactMult = function (a) { return 1 / Math.sin(rad(a)); };
  /* (1 − cos θ) ÷ sin θ, which equals tan(θ/2). */
  RB.exactShrink = function (a) { return Math.tan(rad(a) / 2); };

  /* Offset of depth h at angle a. x (optional) = distance from the conduit end to the obstruction. */
  RB.offset = function (h, a, mode, x) {
    var f = mode === "field" && RB.FIELD_MULT[a] !== undefined;
    var mult = f ? RB.FIELD_MULT[a] : RB.exactMult(a), spi = f ? RB.FIELD_SHRINK[a] : RB.exactShrink(a);
    var r = { field: f, mult: mult, shrinkPerInch: spi, spacing: h * mult, shrink: h * spi, run: h / Math.tan(rad(a)), marks: null };
    if (x !== null && x !== undefined) {
      var m1, m2;
      if (f) { m2 = x + r.shrink; m1 = m2 - r.spacing; } else { m1 = x - r.run; m2 = m1 + r.spacing; }
      r.marks = [m1, m2]; r.tooClose = m1 < 0;
    }
    return r;
  };

  /* 3-point saddle over an obstruction of height h. center = 45 (outer bends 22.5°) or 60 (outer 30°).
     x (optional) = distance from the conduit end to the CENTER of the obstruction. */
  RB.saddle3 = function (h, center, mode, x) {
    var outer = center / 2, f = mode === "field" && center === 45;
    var mult = f ? RB.SADDLE3_FIELD.mult : RB.exactMult(outer), spi = f ? RB.SADDLE3_FIELD.shrink : RB.exactShrink(outer);
    var r = { field: f, outer: outer, mult: mult, shrinkPerInch: spi, centerToOuter: h * mult,
              shrinkToCenter: h * spi, totalShrink: 2 * h * spi, marks: null };
    if (x !== null && x !== undefined) {
      var c = x + r.shrinkToCenter;
      r.marks = [c - r.centerToOuter, c, c + r.centerToOuter]; r.tooClose = r.marks[0] < 0;
    }
    return r;
  };

  /* 4-point saddle (two offsets) over an obstruction of height h and width w at angle a.
     x (optional) = distance from the conduit end to the NEAR face of the obstruction. Without x the marks are
     given from mark 1. */
  RB.saddle4 = function (h, w, a, mode, x) {
    var o = RB.offset(h, a, mode, x === null || x === undefined ? null : x);
    var m1, m2;
    if (o.marks) { m1 = o.marks[0]; m2 = o.marks[1]; } else { m1 = 0; m2 = o.spacing; }
    var m3 = m2 + w, m4 = m3 + o.spacing;
    return { field: o.field, mult: o.mult, shrinkPerInch: o.shrinkPerInch, spacing: o.spacing, shrink: o.shrink,
             totalShrink: 2 * o.shrink, run: o.run, marks: [m1, m2, m3, m4], fromEnd: !!o.marks, tooClose: m1 < 0 };
  };

  /* 90° stub-up: mark = stub height (end to the back of the 90) − take-up. */
  RB.stub90 = function (stub, takeUp) {
    var mark = stub - takeUp;
    return { mark: mark, tooShort: mark <= 0 };
  };
  /* Find your own bender's take-up from a test bend: bend a 90 on a mark, measure the stub to the back. */
  RB.takeUpFromTest = function (mark, measuredStub) { return measuredStub - mark; };

  /* Rolling offset: true offset = √(rise² + roll²); bend it as a normal offset, tilted from vertical. */
  RB.rolling = function (rise, roll, a, mode, x) {
    var t = Math.sqrt(rise * rise + roll * roll), o = RB.offset(t, a, mode, x);
    o.trueOffset = t; o.tilt = Math.atan2(roll, rise) * 180 / Math.PI;
    return o;
  };

  /* ---- small UI helpers used by the calculator pages ---- */
  RB.stat = function (v, l) { return "<div class='stat'><b>" + v + "</b><span>" + l + "</span></div>"; };
  /* Segmented buttons: el = container, items = [{v, label}], cur = selected value, pick(v) on change. */
  RB.seg = function (el, items, cur, pick) {
    items.forEach(function (it) {
      var b = el.ownerDocument.createElement("button"); b.type = "button"; b.textContent = it.label;
      b.setAttribute("data-v", String(it.v)); b.setAttribute("aria-pressed", String(it.v === cur)); el.appendChild(b);
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var v = b.getAttribute("data-v"), it = items.filter(function (i) { return String(i.v) === v; })[0]; if (!it) return;
      [].forEach.call(el.children, function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-v") === v)); });
      pick(it.v);
    });
  };
  RB.steps = function (el, list) {
    el.innerHTML = "";
    list.forEach(function (s) { var li = el.ownerDocument.createElement("li"); li.textContent = s; el.appendChild(li); });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RB; else root.RacewayBend = RB;
})(this);
