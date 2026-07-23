# @es-ts-example/web

This package is the Bun/Effect HTTP composition root. It renders escaped HTML
through JSX and uses ordinary forms with Post/Redirect/Get.

## Routed Surface

`/` is the creator dashboard. The authoring flow uses:

- `/experiences/new/title`
- `/experiences/new/participants`
- `/experiences/new/steps`
- `/experiences/new/builder`
- `/experiences/new/block`
- `/experiences/new/review`

`/media/:mediaId` serves uploaded media, `/client.css` serves compiled styles,
and `/actions/creator/*` handles authoring mutations and publication.
`src/routes.ts` is the path source of truth; `src/server.ts` owns method and
controller wiring.

Browse, play, party, identity, payments, and counter are not routed web
surfaces. The creator slice currently uses the fixed local identity
`creator-local`.

## MVC Boundary

Creator pages use typed render models, pure factories, controllers, and
server-rendered views:

- Controllers decode requests, load application data, and prepare factory
  dependencies. A GET controller returns one page-model factory result; POST
  controllers use Post/Redirect/Get rather than rendering mutation responses.
- Factories are the presentation decision boundary. They translate application
  read data into tagged render states, compose child models, and resolve
  user-facing copy through typed i18n messages. Domain tags and entities do not
  cross into models.
- Each model file exports one owned render model. Private tagged schemas compose
  that model and make impossible state combinations unrepresentable.
- Views only translate render states into markup. They may exhaustively dispatch
  tagged states or compose an independently optional child, but they do not
  infer state from array cardinality, domain values, or coupled optional fields.
  `field-notes` is the default theme;
  `?theme=wayfinder` selects the alternative and is preserved through the PRG
  flow.
- Shared controller mechanics live in support modules, not extra controller
  exports.

Reusable `EsTsExample*` form controls follow the same model/factory/themed-view
contract. Direct boolean state in render schemas is rejected; factories map
binary inputs to tagged presentation states. An optional child model is valid
when absence is the complete independent state. Multiple optionals that must
appear together remain a review smell because syntax-only lint cannot prove
their semantic coupling.

Duplication between themes or models is often coincidental. Prefer explicit
theme-local markup and well-formed render states over abstractions that push
layout decisions back into views.

## Runtime

`bin/main.ts` starts the server. `bin/runtime.ts` selects the domain event store,
media store, place resolver, RPC clients, identity generators, and payment
adapters from validated runtime configuration.

The Postgres storage backend persists events in Postgres but currently uses an
in-memory media blob store. See the root `README.md` for environment variables.

Tailwind 4 and daisyUI 5 compile `src/styles.css` to `public/client.css`;
`start` and `check` build the stylesheet first.

## Local Feedback

```shell
bun --filter @es-ts-example/web build
bun --filter @es-ts-example/web test
bun --filter @es-ts-example/web test:property
bun --filter @es-ts-example/web e2e
bun --filter @es-ts-example/web visual:install
bun --filter @es-ts-example/web visual
bun --filter @es-ts-example/web lint
bun --filter @es-ts-example/web mutation:dev
```

Web e2e tests are Bun HTTP tests under `test/e2e`, not Effect BDD step
definitions.

## Visual gate (Wayfinder)

Playwright compares real HTTP-rendered Wayfinder routes at `390×844` against
committed Figma PNG baselines in `test/visual/baselines/figma/`. Scenario
metadata lives in `test/visual/figma-manifest.ts`.

Chromium is not downloaded during `bun install` when
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set (recommended locally). Install the
browser explicitly before running visual tests:

```shell
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install
bun --filter @es-ts-example/web visual:install
bun --filter @es-ts-example/web build
bun --filter @es-ts-example/web visual
```

CI installs Chromium with system dependencies via `visual:install:ci`.

### Baseline refresh

- `visual:update-actual` writes captured PNGs to `test/visual/baselines/actual/`
  for diff review. It never overwrites Figma baselines.
- `visual:refresh-figma` copies designer exports into `baselines/figma/` only when
  both `FIGMA_BASELINE_REFRESH=1` and `FIGMA_BASELINE_SOURCE=<export-dir>` are
  set.

```shell
FIGMA_BASELINE_REFRESH=1 FIGMA_BASELINE_SOURCE=.tmp/figma-wayfinder/screens \
  bun --filter @es-ts-example/web visual:refresh-figma
```

### Matcher caveat

Playwright captures may differ slightly from Figma PNG exports because of font
rasterization and antialiasing. The enforced gate is `diffPixelRatio <= 0.005`
(0.5% pixels); `ssim.js` also requires SSIM `>= 0.995` when comparison runs.

### Troubleshooting

- Rebuild styles before visual runs: `bun --filter @es-ts-example/web build:styles`.
- If Chromium is missing, rerun `bun --filter @es-ts-example/web visual:install`.
- Inspect failures under `test/visual/results/` and optional actual captures from
  `VISUAL_WRITE_ACTUAL=1 bun --filter @es-ts-example/web visual:update-actual`.
- Forbidden requests (`fonts.googleapis.com`, `fonts.gstatic.com`, `/.tmp/`) fail
  the gate; Wayfinder serves Manrope from `public/fonts/manrope-latin.woff2`.
