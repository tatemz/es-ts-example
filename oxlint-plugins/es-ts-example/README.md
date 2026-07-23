# Local Oxlint Rules

Use this folder for project-specific oxlint JS plugin rules when an invariant is
centered on one linted file and can be checked from syntax, filename context, or
nearby sibling-file facts.

## Rule Catalog

Each rule lives in `rules/<rule-name>/rule.mjs`. Shared AST, path, source-text,
and reporting helpers live in `rules/shared`. Keep `index.mjs` as a registry:
it should import rule modules and expose the `rules` object, not contain rule
implementations.

### Effect, Types, And Runtime Boundaries

- `deterministic-control-flow`: rejects branches better expressed with Effect,
  Match, or collection utilities.
- `effect-boundaries`: keeps Effect execution and mutable boundaries explicit.
- `effect-first-code`: keeps package code on Effect services, typed failures,
  and Effect schema decoding.
- `effect-trypromise-requires-catch`: requires `Effect.tryPromise` boundaries
  to map foreign failures explicitly.
- `import-runtime-boundaries`: keeps platform APIs, route literals, providers,
  and runtime configuration behind adapters.
- `literal-union-ownership`: prevents duplicate local literal unions.
- `no-fallible-module-scope-make`: keeps fallible schema/domain `.make(...)`
  constructors out of module initialization.
- `no-lowercase-effect-order`: catches Effect v4 primitive `Order` member drift.
- `no-option-returning-filter-map`: catches Effect v3-style
  `Arr.filterMap(...Option.some/none...)` callbacks.
- `no-native-standard-library`: keeps production code on Effect standard
  library helpers instead of native shortcuts.
- `strong-types`: bans the highest-risk type escape hatches in core packages.

### Web MVC

- `mvc-classes-stay-in-views`: keeps CSS class fields out of MVC models and
  factories.
- `mvc-controller-no-model-factories`: keeps model construction in factory
  files.
- `mvc-controller-owns-one-controller`: requires each `*.controller.ts` file
  to own one controller.
- `mvc-factory-owns-one-renderable-factory`: requires each factory file to own
  one renderable-model factory.
- `mvc-factory-user-facing-strings-use-i18n`: rejects hard-coded user-facing
  model properties in factories.
- `mvc-file-placement`: keeps concrete MVC files in their flat role lanes and
  views in registered theme folders.
- `mvc-model-no-boolean-state`: rejects direct `Schema.Boolean` fields in web
  model files. Stateful presentation should use private tagged unions selected
  by factories; independently optional child composition may use
  `Schema.optionalKey` with a child model. The rule is syntax-based; semantic
  coupling between multiple optional fields remains a review concern, not
  reliably lintable.
- `mvc-model-owns-one-renderable-model`: requires each model file to own one
  renderable model.
- `mvc-model-requires-factory`: requires each model to have a matching factory.
- `mvc-model-requires-view`: requires each model to be consumed by every
  registered theme.
- `mvc-renderable-variants-use-tags`: requires renderable variants to be
  tagged models.
- `mvc-ui-architecture`: keeps async work out of MVC models, factories, and
  page views, and raw controls out of page views.
- `mvc-view-no-cardinality-decisions`: keeps array cardinality branching out of
  themed views; factories emit tagged empty or populated presentation unions.
- `mvc-view-owns-one-renderable-view`: requires each view file to own one
  renderable view.
- `mvc-view-prefers-model-parameter`: requires exported views to accept a
  `model` parameter.
- `mvc-view-requires-model-sibling`: requires each view to import its matching
  model.

### Web UI And Internationalization

- `i18n-message-catalogs`: prevents duplicate message ids within a catalog.
- `view-filenaming-convention`: enforces the `*.view.tsx` naming contract.
- `web-ui-component-contracts`: keeps reusable `EsTsExample*` components public,
  stable, and identifiable in rendered markup.
- `web-view-model-strings`: requires views to receive user-facing copy through
  models.

### Tests

- `rendered-dom-contract`: prevents brittle assertions against rendered CSS
  class strings.
- `test-assertion-boundaries`: keeps one assertion boundary per test body.
- `test-assertion-quality`: requires exact, mutation-resistant assertions.
- `test-discipline`: prevents nested Effect runners in Effect test bodies.
- `test-fixture-boundaries`: keeps runtime demo fixtures out of unit tests.
- `unit-test-architecture`: keeps unit tests local and assertion-transparent.

### Repository Policy

- `public-entrypoint-policy`: keeps package entrypoints small and free of seed
  exports.
- `repo-path-policy`: prevents TypeScript path literals from escaping the
  repository.

## Testing

Every rule must have `RuleTester` coverage in `test/unit/oxlint-rules.test.mjs`.
The root `lint:custom-rule-tests` script imports this plugin and fails if an
exported custom rule lacks a matching `RuleTester` entry.

Oxlint's `RuleTester` currently requires Node 24, so these tests run with
`node --test` while the product test suites remain on Bun.
