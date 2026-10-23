# Raceway — public pages

Privacy policy, support pages and free conduit-bending calculators for the iOS app **Raceway: Conduit Bending**, published with GitHub Pages.

- Privacy policy: https://oguzcamurr.github.io/raceway-privacy/
- Support: https://oguzcamurr.github.io/raceway-privacy/support.html

This repository contains only these public pages. The app's source code is not here.

## Free calculator pages

Every page runs entirely in the browser: no analytics, no trackers, no cookies, no external scripts or fonts, no network requests. The math lives in `assets/bend.js` (point model, the same conventions as the offset calculator and the app's point model).

| Page | Target queries | App Store campaign token |
|---|---|---|
| `conduit-bending-calculator/` (hub) | conduit bending calculator, conduit bending app for iphone, what is shrink conduit bending, conduit bending multipliers | `web-conduit-bending-calculator` |
| `conduit-offset-calculator/` | conduit offset calculator, conduit offset bend calculator, offset multiplier, how to offset emt | `web-conduit-offset-calculator` |
| `saddle-bend-calculator/` | saddle bend calculator, 3 point / 4 point saddle bend calculator, saddle bend formula, emt saddle bend calculator, how to saddle bend | `web-saddle-bend-calculator` |
| `90-degree-bend-calculator/` | how to bend conduit 90 degrees, conduit bending chart 90 degree, stub up / take-up / deduct | `web-90-degree-bend-calculator` |
| `rolling-offset-calculator/` | conduit rolling offset calculator | `web-rolling-offset-calculator` |
| `conduit-bending-chart/` | conduit bending chart (pdf / printable), conduit offset multiplier chart, emt bending chart, 15 degree multiplier | `web-conduit-bending-chart` |
| `index.html`, `support.html` | (brand) | `web-privacy`, `web-support` |

- **Smart App Banner:** every page has `<meta name="apple-itunes-app" content="app-id=6821341136">`, so iOS Safari shows the native App Store banner. Banner taps carry no campaign token.
- **Campaign links:** App Store links look like `…/id6821341136?ct=web-<page>&amp;mt=8` with a matching `data-ct="web-<page>"`. There is no `pt=` yet. Once the provider token is set in GrowthPilot, its `attribution.tag_html` / `tag_site` rebuild these links with `pt` added and the `ct` from `data-ct` kept. Tokens stay within Apple's 30-character limit.
- **Sitemap:** `sitemap.xml` lists every page. Submit it in Google Search Console (owner account) after publishing.

## Checks before publishing

```sh
node --test tests/bend-math.test.js   # formulas, page wiring, FAQ/JSON-LD match, links, no external requests
```

## Publishing (owner-approved only)

Changes are prepared on a branch and are not live until the owner merges and pushes `main`:

```sh
git checkout main && git merge --ff-only <branch> && git push origin main
```

GitHub Pages redeploys within a few minutes. GrowthPilot keeps its own copy under `growthpilot/sites/raceway/`. Copy changed pages there only if GrowthPilot should tag them.
