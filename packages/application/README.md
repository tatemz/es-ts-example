# @es-ts-example/application

This package coordinates domain decisions with infrastructure. It should not
invent business rules; it loads aggregates, runs domain decisions, saves events,
builds read models, and exposes typed RPC contracts.

## Contexts And Composition

Application code is organized around the domain's counter, experience,
adventure, identity, and payments contexts. Command code must not depend on read
models, and queries must not depend on commands.

Keep cross-context wiring in explicit composition boundaries. For example,
`composition.ts` adapts published experience revisions for adventure, while
payment handlers intentionally read adventure and experience repositories.

## Handler Boundary

Command handlers own orchestration:

1. Decode command input at the boundary.
2. Load the aggregate through a repository.
3. Run the pure domain decision with `runDecision`.
4. Save pending events with command metadata.
5. Return a receipt or read model shape for callers.

Do not hide domain choices in handlers. If a branch decides business validity,
move it into `packages/domain`.

## Rejections

Domain decisions return `Result<Aggregate, TaggedInvariant>`. Application
handlers preserve that invariant in the Effect error channel and add concrete
infrastructure errors such as `ExpectedVersionConflict` and event-store errors.
`runDecision` performs the Result-to-Effect bridge; it does not wrap the domain
failure. See `packages/domain/README.md` for the invariant policy.

## RPC And Read Models

RPC contracts are transport boundaries, not a second domain model. Their errors
expose domain invariants plus concrete infrastructure failures.

Queries build client-facing read models by folding events. Read models may
contain provider-enriched data, but command decisions must not read them or
persist that enrichment back into domain events.

Consumers import the package root, the constrained `./experience` API, or the
provider-backed `./payments-live` adapters. Do not deep-import `src` files.

## Infrastructure Services

- `DomainEventStore` supplies in-memory, json-file, and Postgres event storage.
- `MediaBlobStore` supplies in-memory and json-file media storage.
- `PlaceResolver` isolates provider search and resolution.
- Payment collection, payout, webhook, and processed-event services isolate
  payment providers.

Context repositories narrow the shared domain event store with schema decoding;
do not create a second persistence abstraction. `packages/web/bin/runtime.ts`
selects and layers the concrete services.

## Tests

Unit tests cover handlers and adapters; property tests cover broad invariants.
Product BDD features live in `features/product`, with application step
definitions under `packages/application/test/e2e/steps`. Payment feature files
are not wired into the package `e2e` script yet.
