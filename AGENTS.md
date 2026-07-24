# AGENTS.md

This is the shared operating manual for contributors. Start with `README.md`
for setup, commands, runtime configuration, and the architecture overview.

## Product

This is a counter event-sourcing POC. A bounded counter (0..5, disable-to-
freeze) is modeled as pure domain decisions and persisted as an event stream;
current state is always rebuilt by replaying events.

A shared Effect application core exposes commands and queries over in-process
RPC. Two views consume the same RPC client tags: a CLI (`packages/cli`) and a
server-rendered web MVC (`packages/web`). Views never touch the domain or store
directly. The behavior contract lives in `features/product`.

## Operating Principles

This is example code held to production standards. Do not preserve compatibility
with unshipped branch work; replace weak paths instead of layering shims around
them.

Load and read https://www.martinfowler.com/articles/continuousIntegration.html.

Reduce decision density rather than hiding branches in vague helpers. Prefer
Fowler refactorings such as Extract Function, Decompose Conditional, Replace
Nested Conditional with Guard Clauses, and Split Phase. A helper should name a
domain decision or phase.

Delete replaced APIs, event shapes, fixtures, and workflows. Keep a
compatibility shim only for shipped data, an external contract, or an approved
migration window.

## Codebase Style

Use Effect v4 interfaces, standard libraries, dependency injection, and the
fiber runtime. Prefer idiomatic generators and `pipe()` chains. Decode inputs at
trust boundaries and model expected failures explicitly.

## Codebase Map

This is a Bun workspace for a TypeScript, Effect-based, event-sourced example
with schema-decoded boundaries.

- `packages/domain`: pure counter decisions and events.
- `packages/application`: handlers, RPC contracts, read models, and the
  `DomainEventStore` service.
- `packages/event-sourcing`: product-agnostic event-sourcing contracts and
  stores (memory, json-file, postgres).
- `packages/cli`: argv-driven terminal view over the RPC client.
- `packages/web`: Bun/Effect HTTP composition root and server-rendered MVC.
- `packages/test-support`: shared Effect test helpers.
- `features/product`: customer-valued Gherkin exercised by domain and
  application step definitions.

Read the package README before changing a package boundary. Use `README.md` for
commands and runtime configuration.

## Style North Star

Follow nearby patterns and treat `es-ts-example/*` oxlint rules as executable
architecture guidance.

Documentation should explain boundaries, workflows, invariants, and
current-state traps. Do not restate the tree, types, exports, or scripts.

## Effect v4 Beta Traps

- `Arr.filterMap` callbacks return `Result`, not `Option`. Use `Arr.filter` plus
  `Arr.map`, or return `Result` values.
- Primitive orders are capitalized: `Order.String` and `Order.Number`, not
  `Order.string`.
- Schema and branded `.make` constructors validate and may throw. Do not call
  them in module-scope constants: mutation can then crash module loading. Use a
  type-ascribed literal (`no-fallible-module-scope-make` enforces this).
- `no-native-standard-library` prefers Effect collection and string helpers.
  Their APIs differ from native methods; for example, `Str.matchAll` returns an
  `IterableIterator` and `Str.split` is curried.

## Commits and Integration

The Husky pre-commit hook runs `bun run check`. It includes:

- TypeScript builds and Oxfmt.
- Oxlint plus local `es-ts-example/*` rules and repository policy scripts.
- Dependency Cruiser and knip.
- Unit tests at 100% coverage, property tests, Effect BDD, and package e2e
  tests.
- Stryker at a 100% mutation threshold.

Use the cheapest relevant feedback first:

1. `bun --filter @es-ts-example/<package> lint` and `test`.
2. `bun --filter @es-ts-example/<package> mutation:dev`.
3. `bun run lint:policy`, `bun run lint:package-boundaries`,
   `bun run lint:knip`, and `bun run format:check` when relevant.
4. `bun --filter @es-ts-example/<package> check`, then commit; pre-commit runs
   `bun run check`.

Do not bypass the pre-commit hook.

Gate traps:

- knip rejects speculative exports.
- A package with `src/**` needs the repository-standard scripts,
  `bunfig.toml`, and a 100% `stryker.config.json`.
- Shape-only or success-only assertions usually leave surviving mutants.
