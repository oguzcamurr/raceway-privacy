// Checks for the free calculator pages. Run from the repo root: node --test tests/
// No network access: everything is read from this repository.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const RB = require(path.join(ROOT, "assets/bend.js"));
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const rad = d => d * Math.PI / 180;
const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} vs ${b}`);

const PAGES = {
  "conduit-bending-calculator/index.html": "conduit-bending-calculator",
  "conduit-offset-calculator/index.html": "conduit-offset-calculator",
  "saddle-bend-calculator/index.html": "saddle-bend-calculator",
  "90-degree-bend-calculator/index.html": "90-degree-bend-calculator",
  "rolling-offset-calculator/index.html": "rolling-offset-calculator",
  "conduit-bending-chart/index.html": "conduit-bending-chart",
  "index.html": "privacy",
  "support.html": "support",
};

/* ---------------- reference values ---------------- */

test("exact multipliers and shrink match standard trig tables", () => {
  // 1 / sin θ and tan(θ/2), to 3 decimals, as printed in apprenticeship references.
  const ref = { 5: [11.474, 0.044], 10: [5.759, 0.087], 15: [3.864, 0.132], 22.5: [2.613, 0.199],
                30: [2.000, 0.268], 45: [1.414, 0.414], 60: [1.155, 0.577] };
  for (const [a, [m, s]] of Object.entries(ref)) {
    close(RB.exactMult(+a), m, 0.0005, `mult ${a}`);
    close(RB.exactShrink(+a), s, 0.0005, `shrink ${a}`);
    // shrink per inch = (1 − cos θ) / sin θ = csc θ − cot θ = tan(θ/2)
    close(RB.exactShrink(+a), (1 - Math.cos(rad(+a))) / Math.sin(rad(+a)), 1e-12, `identity ${a}`);
  }
});

test("field chart values are the common trade-chart numbers and close to exact", () => {
  assert.deepEqual(RB.FIELD_MULT, { 10: 6, 22.5: 2.6, 30: 2, 45: 1.4, 60: 1.2 });
  assert.deepEqual(RB.FIELD_SHRINK, { 10: 1 / 16, 22.5: 3 / 16, 30: 1 / 4, 45: 3 / 8, 60: 1 / 2 });
  for (const a of RB.ANGLES) {
    assert.ok(Math.abs(RB.FIELD_MULT[a] - RB.exactMult(a)) / RB.exactMult(a) < 0.05, `mult ${a}`);
    assert.ok(Math.abs(RB.FIELD_SHRINK[a] - RB.exactShrink(a)) <= 0.08, `shrink ${a}`);
  }
  // 3-point saddle field rule (45° center, 22.5° outers): 2.5 vs 2.613 exact, 3/16" vs 0.199" per inch.
  assert.equal(RB.SADDLE3_FIELD.mult, 2.5);
  assert.equal(RB.SADDLE3_FIELD.shrink, 3 / 16);
  assert.ok(Math.abs(2.5 - RB.exactMult(22.5)) / RB.exactMult(22.5) < 0.05);
  assert.ok(Math.abs(3 / 16 - RB.exactShrink(22.5)) < 1 / 64);
  // take-up printed on common EMT hand benders
  assert.deepEqual(RB.TAKE_UP.map(t => [t.size, t.inches]),
    [["1/2\" EMT", 5], ["3/4\" EMT", 6], ["1\" EMT", 8], ["1-1/4\" EMT", 11]]);
});

/* ---------------- formatting ---------------- */

test("tape-measure fractions and input parsing", () => {
  const f = RB.frac;
  assert.equal(f(1.6077, 16), "1 5/8\"");
  assert.equal(f(12, 16), "12\"");
  assert.equal(f(0.5, 16), "1/2\"");
  assert.equal(f(15.999, 16), "16\"");
  assert.equal(f(2.679, 16), "2 11/16\"");
  assert.equal(f(2.679, 8), "2 5/8\"");
  assert.equal(f(-0.25, 16), "−1/4\"");
  assert.equal(f(0.01, 16), "0\"");
  assert.equal(RB.parse("4 1/2"), 4.5);
  assert.equal(RB.parse("3-3/8"), 3.375);
  assert.equal(RB.parse("5.25"), 5.25);
  assert.equal(RB.parse("7/8\""), 0.875);
  assert.equal(RB.parse(""), null);
  assert.ok(Number.isNaN(RB.parse("abc")));
  assert.ok(Number.isNaN(RB.parse("1/0")));
});

test("parse, frac and num are identical to the offset calculator page's own code", () => {
  const html = read("conduit-offset-calculator/index.html");
  const grab = name => html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n(?=function |var )`))[0];
  const ctx = vm.createContext({});
  vm.runInContext(grab("parse") + grab("frac") + grab("num"), ctx);
  const inputs = ["6", "4 1/2", "3-3/8", "5.25", "", "x", "1/0", "12\"", " 7 / 8 ", "10.0625"];
  for (const v of inputs) assert.deepEqual(ctx.parse(v), RB.parse(v), `parse ${v}`);
  for (let x = -3; x <= 40; x += 0.0371) for (const d of [8, 16, 32]) assert.equal(ctx.frac(x, d), RB.frac(x, d));
  for (let x = 0; x <= 40; x += 0.0371) assert.equal(ctx.num(x), RB.num(x));
});

/* ---------------- geometry oracle (point model) ----------------
   Walk along the conduit from the end: straight to each mark, then turn. Each segment is
   [length along the conduit, direction in degrees above the original line]. */
function walk(segs) {
  let x = 0, y = 0; const pts = [[0, 0]];
  for (const [len, dir] of segs) { x += len * Math.cos(rad(dir)); y += len * Math.sin(rad(dir)); pts.push([x, y]); }
  return pts;
}

test("offset: marks put the conduit at full depth exactly at the obstruction; shrink is the reach lost", () => {
  for (const a of RB.ANGLES) for (const h of [0.5, 2, 4.25, 6, 13]) {
    const x = 60, o = RB.offset(h, a, "exact", x), [m1, m2] = o.marks;
    close(m2 - m1, h / Math.sin(rad(a)), 1e-9, "spacing");
    const L = 120, p = walk([[m1, 0], [m2 - m1, a], [L - m2, 0]]);
    close(p[2][1], h, 1e-9, "depth at bend 2");
    close(p[2][0], x, 1e-9, "bend 2 lands at the obstruction");
    close(L - p[3][0], o.shrink, 1e-9, "shrink");
    // field mode uses the same layout with the rounded chart numbers
    const fo = RB.offset(h, a, "field", x);
    close(fo.marks[1], x + h * RB.FIELD_SHRINK[a], 1e-12);
    close(fo.marks[1] - fo.marks[0], h * RB.FIELD_MULT[a], 1e-12);
    // exact mode: mark 2 = obstruction + shrink as well (same rule as the field chart)
    close(m2, x + o.shrink, 1e-9);
  }
});

test("3-point saddle: apex at full height over the obstruction center; total shrink = 2 × shrink to center", () => {
  for (const c of [45, 60]) for (const h of [1, 2, 3.5, 6]) {
    const x = 50, s = RB.saddle3(h, c, "exact", x), [o1, cm, o2] = s.marks, phi = c / 2;
    close(cm - o1, h / Math.sin(rad(phi)), 1e-9);
    close(o2 - cm, cm - o1, 1e-12);
    const L = 120, p = walk([[o1, 0], [cm - o1, phi], [o2 - cm, -phi], [L - o2, 0]]);
    close(p[2][1], h, 1e-9, "apex height");
    close(p[2][0], x, 1e-9, "apex over the center");
    close(p[3][1], 0, 1e-9, "back on the original line");
    close(L - p[4][0], s.totalShrink, 1e-9, "total shrink");
  }
  // Field rule, 45° center: center = distance + 3/16" per inch, outers 2.5 × height each side
  const f = RB.saddle3(2, 45, "field", 30);
  assert.deepEqual(f.marks.map(m => RB.frac(m, 16)), ["25 3/8\"", "30 3/8\"", "35 3/8\""]);
  assert.equal(RB.frac(f.totalShrink, 16), "3/4\"");
  // 60° center has no separate field rule: field mode falls back to exact
  const s60 = RB.saddle3(2, 60, "field", null);
  assert.equal(s60.field, false); close(s60.mult, 2, 1e-12); close(s60.shrinkPerInch, Math.tan(rad(15)), 1e-12);
  assert.equal(RB.saddle3(2, 45, "exact", 1).tooClose, true);
});

test("4-point saddle: at full height from the near face across the whole width, then back down", () => {
  for (const a of RB.ANGLES) for (const [h, w] of [[2, 6], [4, 10], [5.5, 24]]) {
    const x = 70, s = RB.saddle4(h, w, a, "exact", x), [m1, m2, m3, m4] = s.marks;
    const L = 200, p = walk([[m1, 0], [m2 - m1, a], [m3 - m2, 0], [m4 - m3, -a], [L - m4, 0]]);
    close(p[2][0], x, 1e-9, "full height at the near face"); close(p[2][1], h, 1e-9);
    close(p[3][0], x + w, 1e-9, "still at full height at the far face"); close(p[3][1], h, 1e-9);
    close(p[4][1], 0, 1e-9, "back on the original line");
    close(L - p[5][0], s.totalShrink, 1e-9, "total shrink");
    const n = RB.saddle4(h, w, a, "exact", null);
    assert.equal(n.fromEnd, false); close(n.marks[0], 0, 0); close(n.marks[3], 2 * n.spacing + w, 1e-12);
  }
  const f = RB.saddle4(4, 10, 30, "field", 40);
  assert.deepEqual(f.marks.map(m => RB.frac(m, 16)), ["33\"", "41\"", "51\"", "59\""]);
  assert.equal(RB.frac(f.totalShrink, 16), "2\"");
});

test("rolling offset: true offset is the diagonal; tilting it by the roll angle gives the rise and roll", () => {
  for (const [ri, ro] of [[6, 8], [3, 4], [10, 0], [0, 7], [5.5, 2.25]]) for (const a of RB.ANGLES) {
    const r = RB.rolling(ri, ro, a, "exact", null);
    close(r.trueOffset, Math.hypot(ri, ro), 1e-12);
    close(r.trueOffset * Math.cos(rad(r.tilt)), ri, 1e-9, "rise");
    close(r.trueOffset * Math.sin(rad(r.tilt)), ro, 1e-9, "roll");
    const o = RB.offset(r.trueOffset, a, "exact", null);
    close(r.spacing, o.spacing, 1e-12); close(r.shrink, o.shrink, 1e-12);
  }
  const ex = RB.rolling(6, 8, 30, "exact", null);
  assert.equal(RB.frac(ex.trueOffset, 16), "10\""); assert.equal(RB.frac(ex.spacing, 16), "20\"");
  assert.equal(RB.frac(ex.shrink, 16), "2 11/16\""); assert.equal(ex.tilt.toFixed(1), "53.1");
});

test("90° stub-up: mark = stub − take-up; take-up from a test bend is the inverse", () => {
  assert.equal(RB.stub90(12, 5).mark, 7);
  assert.equal(RB.stub90(18, 6).mark, 12);
  assert.equal(RB.stub90(10, 8).mark, 2);
  assert.equal(RB.stub90(5, 5).tooShort, true);
  for (const t of RB.TAKE_UP) for (const s of [9, 12, 17.5, 48]) assert.equal(RB.takeUpFromTest(RB.stub90(s, t.inches).mark, s), t.inches);
});

/* ---------------- pages run end to end in a tiny DOM stub ---------------- */

function loadPage(file) {
  const html = read(file), els = {};
  const doc = { getElementById: id => els[id] || null, createElement: tag => mk(tag) };
  function mk(tag, id) {
    const e = { tagName: tag, id, children: [], attrs: {}, listeners: {}, dataset: {}, _html: "", textContent: "",
      value: "", hidden: false, ownerDocument: doc, parentNode: null,
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
      closest(sel) { let n = this; while (n) { if (n.tagName === sel) return n; n = n.parentNode; } return null; } };
    Object.defineProperty(e, "innerHTML", { get() { return this._html; }, set(v) { this._html = v; this.children = []; } });
    return e;
  }
  for (const m of html.matchAll(/<(\w+)\b([^>]*?)\sid="([^"]+)"([^>]*)>/g)) {
    const at = m[2] + m[4], e = mk(m[1], m[3]), v = at.match(/\bvalue="([^"]*)"/);
    if (v) e.value = v[1]; if (/\shidden(\s|$|>)/.test(at + ">")) e.hidden = true; els[m[3]] = e;
  }
  for (const m of html.matchAll(/<select id="([^"]+)"><option value="([^"]*)"/g)) els[m[1]].value = m[2];
  const ctx = vm.createContext({ document: doc, Math, String, Number, isNaN, parseFloat }); ctx.window = ctx;
  for (const m of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))
    vm.runInContext(m[1] ? fs.readFileSync(path.join(ROOT, path.dirname(file), m[1]), "utf8") : m[2], ctx);
  const api = {
    els,
    set(id, v) { els[id].value = String(v); (els[id].listeners.input || []).forEach(fn => fn({ target: els[id] })); },
    pick(groupId, v) {
      const g = els[groupId];
      let b = g.children.find(c => c.getAttribute("data-v") === String(v) || c.dataset.a == v || c.dataset.m === v);
      if (!b && new RegExp(`id="${groupId}"[^>]*>(?:(?!</div>)[\\s\\S])*data-m="${v}"`).test(html)) {
        b = mk("button"); b.dataset.m = v; b.parentNode = g;    // buttons written in the HTML (offset page modes)
      }
      assert.ok(b, `button ${v} in #${groupId}`);
      g.listeners.click.forEach(fn => fn({ target: b }));
    },
    stats(id = "out") { return [...els[id].innerHTML.matchAll(/<b>(.*?)<\/b>/g)].map(m => m[1]); },
    steps(id = "how") { return els[id].children.map(c => c.textContent); },
    err(id = "err") { return els[id].textContent; },
  };
  return api;
}

test("offset calculator page gives the same results as the shared math", () => {
  const p = loadPage("conduit-offset-calculator/index.html");
  for (const m of ["exact", "field"]) {
    p.pick("modes", m);
    for (const a of RB.ANGLES) {
      p.pick("angles", a);
      for (const [h, x] of [[6, ""], [4.5, 48], [2, 30], [10, 100]]) {
        p.set("obst", x); p.set("depth", h);
        const o = RB.offset(h, a, m, x === "" ? null : x), f = v => RB.frac(v, 16);
        const want = [f(o.spacing), f(o.shrink)].concat(o.marks && !o.tooClose ? o.marks.map(f) : []);
        assert.deepEqual(p.stats(), want, `${m} ${a}° ${h}" ${x}`);
      }
    }
  }
});

test("saddle page: 3-point and 4-point worked examples and errors", () => {
  const p = loadPage("saddle-bend-calculator/index.html");
  p.set("x3", 30);
  assert.deepEqual(p.stats(), ["5\"", "3/8\"", "3/4\"", "25 3/8\"", "30 3/8\"", "35 3/8\""]);
  assert.equal(p.els.p4w.hidden, true); assert.equal(p.els.p3x.hidden, false);
  p.pick("modes", "exact");
  const ex = RB.saddle3(2, 45, "exact", 30);
  assert.deepEqual(p.stats(), [ex.centerToOuter, ex.shrinkToCenter, ex.totalShrink].concat(ex.marks).map(v => RB.frac(v, 16)));
  p.pick("center", 60); p.pick("modes", "field");
  assert.ok(p.steps().some(s => s.includes("60° center uses the exact values")));
  p.set("x3", 1); assert.match(p.err(), /too close/);
  p.pick("type", "4"); assert.equal(p.els.p4w.hidden, false); assert.equal(p.els.p3x.hidden, true);
  p.set("h", 4); p.set("w", 10); p.set("x4", 40); p.pick("angles", 30);
  assert.deepEqual(p.stats(), ["8\"", "1\"", "2\"", "33\"", "41\"", "51\"", "59\""]);
  p.set("x4", ""); assert.ok(p.steps().some(s => s.includes("measured from mark 1")));
  p.set("h", "abc"); assert.match(p.err(), /height/);
});

test("90° page: stub mark, custom take-up, too-short stub and take-up from a test bend", () => {
  const p = loadPage("90-degree-bend-calculator/index.html");
  assert.deepEqual(p.stats(), ["7\"", "5\""]);
  assert.deepEqual(p.stats("out2"), ["5\""]);
  p.pick("sizes", 6); p.set("stub", 18); assert.deepEqual(p.stats(), ["12\"", "6\""]);
  p.pick("sizes", "custom"); assert.equal(p.els.cust.hidden, false);
  p.set("tu", "4 1/2"); p.set("stub", 12); assert.deepEqual(p.stats(), ["7 1/2\"", "4 1/2\""]);
  p.set("stub", 4); assert.match(p.err(), /not longer than/);
  p.set("tm", 6); p.set("ts", "14 1/4"); assert.deepEqual(p.stats("out2"), ["8 1/4\""]);
});

test("rolling offset page: 6-8-10 example and marks", () => {
  const p = loadPage("rolling-offset-calculator/index.html");
  assert.deepEqual(p.stats(), ["10\"", "20\"", "2 11/16\"", "53.1°"]);
  p.set("obst", 48);
  const r = RB.rolling(6, 8, 30, "exact", 48);
  assert.deepEqual(p.stats().slice(4), r.marks.map(v => RB.frac(v, 16)));
  p.pick("modes", "field"); p.pick("angles", 45);
  const f = RB.rolling(6, 8, 45, "field", 48);
  assert.deepEqual(p.stats(), [f.trueOffset, f.spacing, f.shrink].map(v => RB.frac(v, 16)).concat([f.tilt.toFixed(1) + "°"], f.marks.map(v => RB.frac(v, 16))));
  p.set("rise", 0); p.set("roll", 0); assert.match(p.err(), /not both 0/);
});

/* ---------------- page content ---------------- */

const unesc = s => s.replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

test("FAQ structured data matches questions and answers shown on the page", () => {
  for (const file of Object.keys(PAGES)) {
    const html = read(file);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const faq = blocks.find(b => b["@type"] === "FAQPage");
    if (!faq) continue;
    const h3 = [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => unesc(m[1]));
    const ps = [...html.matchAll(/<p>(.*?)<\/p>/g)].map(m => unesc(m[1]));
    for (const q of faq.mainEntity) {
      assert.ok(h3.includes(q.name), `${file}: question on page: ${q.name}`);
      assert.ok(ps.includes(q.acceptedAnswer.text), `${file}: answer on page: ${q.name}`);
    }
  }
});

test("every page: Smart App Banner, tagged App Store links, unique title/description, canonical", () => {
  const titles = new Set(), descs = new Set();
  for (const [file, slug] of Object.entries(PAGES)) {
    const html = read(file);
    assert.ok(html.includes('<meta name="apple-itunes-app" content="app-id=6821341136">'), `${file} banner`);
    const links = [...html.matchAll(/<a\b[^>]*href="(https:\/\/apps\.apple\.com\/[^"]*)"[^>]*>/g)];
    assert.ok(links.length >= 1, `${file} has an App Store link`);
    for (const m of links) {
      const ct = "web-" + slug;
      assert.ok(ct.length <= 30, `${ct} fits Apple's 30-character campaign token limit`);
      assert.equal(m[1], `https://apps.apple.com/us/app/raceway-conduit-bending/id6821341136?ct=${ct}&amp;mt=8`, file);
      assert.ok(m[0].includes(`data-ct="${ct}"`), `${file} data-ct`);
    }
    const title = html.match(/<title>(.*?)<\/title>/)[1], desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(!titles.has(title) && !descs.has(desc), `${file} unique title/description`); titles.add(title); descs.add(desc);
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/)[1];
    const expect = "https://oguzcamurr.github.io/raceway-privacy/" + (file === "index.html" ? "" : file.replace(/index\.html$/, ""));
    assert.equal(canon, expect, `${file} canonical`);
    const og = html.match(/<meta property="og:url" content="([^"]*)"/); if (og) assert.equal(og[1], expect);
  }
});

test("internal links resolve to files in this repository, and every page is in the sitemap", () => {
  const sitemap = read("sitemap.xml");
  for (const file of Object.keys(PAGES)) {
    const html = read(file), dir = path.dirname(file);
    for (const m of html.matchAll(/\b(?:href|src)="([^"#]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:)/.test(u)) continue;
      let target = path.normalize(path.join(dir, u)); if (u.endsWith("/") || u === "./" || u === "../") target = path.join(target, "index.html");
      assert.ok(fs.existsSync(path.join(ROOT, target)), `${file} -> ${u}`);
    }
    const url = "https://oguzcamurr.github.io/raceway-privacy/" + (file === "index.html" ? "" : file.replace(/index\.html$/, ""));
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap has ${url}`);
  }
});

test("no external requests: only App Store links and the site's own canonical URLs", () => {
  for (const file of Object.keys(PAGES).concat(["assets/bend.js"])) {
    const html = read(file);
    for (const m of html.matchAll(/\b(?:src|href|content|action)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/g)) {
      assert.ok(/^https:\/\/apps\.apple\.com\//.test(m[1]) || m[1].startsWith("https://oguzcamurr.github.io/raceway-privacy/"), `${file}: ${m[1]}`);
    }
    assert.ok(!/<link\b[^>]*rel="(?:stylesheet|preconnect|prefetch|dns-prefetch)"/.test(html), `${file} external stylesheet/preconnect`);
    assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage)\b/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")), `${file} network/storage API`);
    assert.ok(!/@import|url\(/.test(html), `${file} CSS import/url()`);
  }
});
