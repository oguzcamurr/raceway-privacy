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
- **Campaign links:** every App Store link uses Apple's documented campaign-link form, `https://apps.apple.com/app/apple-store/id6821341136?pt=128209741&ct=web-<page>&mt=8` (written with `&amp;` in the HTML), with a matching `data-ct="web-<page>"`. `pt` is the App Store Connect provider token; `ct` is one token per page (privacy, support and each calculator), never per link, because App Analytics shows a campaign figure only once it reaches 5 users. The links are generated with GrowthPilot's `attribution.tag_html`, so the site and GrowthPilot agree; re-running it rebuilds the query instead of appending. Tokens are lowercase `[a-z0-9-]` and within Apple's 30-character limit.
- **Where the App Store link sits:** on every page one link is on the first screen on a phone (calculator pages: under the intro; privacy page: in the top navigation; support page: third paragraph). Each calculator also has one directly under its result, inside the calculator card, plus the "Raceway for iPhone" section at the end. All of them carry the page's single token.
- **What is measured:** App Store Connect → App Analytics → Campaigns reports downloads, sales and product page views per `ct` (first-time downloads within 24 hours of the tap, last campaign link wins, data after about 24 hours, figures shown only at 5 or more users, small noise added). Taps on these links are not measured anywhere, and installs from the Smart App Banner carry no token.
- **Sitemap:** `sitemap.xml` lists all 8 pages with `lastmod`. Submit it in Google Search Console (owner account, after verifying the URL-prefix property `https://oguzcamurr.github.io/raceway-privacy/`).
- **robots.txt:** not possible here. Crawlers only read `/robots.txt` at the host root (`https://oguzcamurr.github.io/robots.txt`), which a GitHub Pages *project* site cannot serve; only a user site repository named `oguzcamurr.github.io` could. That URL currently returns 404, which crawlers treat as "everything allowed". No page uses `noindex`.

## Checks before publishing

```sh
node --test tests/bend-math.test.js   # formulas, page wiring, FAQ/JSON-LD match, campaign links, links, sitemap, no external requests
```

## Publishing (owner-approved only)

Changes are prepared on a branch and are not live until the owner merges and pushes `main`:

```sh
git checkout main && git merge --ff-only <branch> && git push origin main
```

GitHub Pages redeploys within a few minutes. GrowthPilot keeps a copy of the published pages under `sites/raceway/` in its repository; copy changed pages there after publishing so both stay in sync.
