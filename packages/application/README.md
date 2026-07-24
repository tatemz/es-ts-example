# @es-ts-example/application

This package coordinates domain decisions with infrastructure. It invents no
business rules: it loads aggregates, runs domain decisions, appends events,
builds read models, and exposes typed RPC contracts that the CLI and web views
both consume.

Two slices live here, `counter` and `user`, and each keeps commands and queries
apart. Command code must not import a read model, and a query must not import a
handler.

## Handler Boundary

A command handler owns orchestration in a fixed order:

1. Decode command input at the boundary.
2. Load the aggregate through the slice repository.
3. Run the pure domain decision.
4. Commit the accepted decision.
5. Return a receipt.

If a branch decides business validity, it belongs in `packages/domain`, not in a
handler.

## Receipts Versus Summaries

A command returns a `CounterCommandReceipt`: an id and a version, the two facts
that exist for every aggregate. It deliberately cannot describe state, so no
handler has to invent a value for a counter that a rejected command never
changed. A caller that wants state issues a query, which returns a
`CounterSummary` — a tagged union with an arm per state that can exist and no arm
for `CounterNotCreated`.

## Rejections

Domain decisions return `Result<Aggregate, Rejection>`. Handlers keep that
rejection in the Effect error channel and add the infrastructure failures the
write path can really produce: `ExpectedVersionConflict` and event-store
failures. The repository `commit` performs the Result-to-Effect bridge; it does
not wrap or flatten domain failures.

## The Shared Kernel: One Event Stream For Every Slice

Every slice appends to one `DomainEventStore` holding one `DomainEvent` union.
That is the central tradeoff in this codebase, and it is a deliberate teaching
choice rather than a default.

What it buys: one store implementation to write and swap (memory, json-file,
postgres), one place where ordering and version conflicts are defined, and a log
you can read end to end without joining anything.

What it costs: a slice can no longer assume everything in the store belongs to
it. `eventStoreFor` in `src/eventStore.ts` exists solely to pay that cost. It
narrows the shared stream to one slice's events with a single policy shared by
reads and writes: an event from another slice is expected, so it is filtered
rather than treated as corruption. Because the store hands back events that are
already decoded, the narrowing is a refinement, not a second decode, and there is
no failure mode to invent.

What a production system would likely do instead: give each bounded context its
own store and its own event union, so narrowing disappears and contexts can be
deployed and versioned separately. That is the right call when contexts have
different owners or lifecycles. It is the wrong call for an example, because it
would triple the infrastructure a reader has to hold in their head to follow one
counter from command to projection.

Do not add a second persistence abstraction to work around the shared stream.
Narrow it.

## RPC Contracts

RPC is a transport boundary, not a second domain model. Each contract publishes
the precise error union a caller can receive — domain rejections plus concrete
infrastructure failures — and both views consume the client tags directly so
that union survives to the call site.

`packages/web/bin/runtime.ts` and `packages/cli` select the storage layer and
provide the client layers. Consumers import the package root; do not deep-import
`src` files.

## Read Models

`listCounters` replays each counter stream through the same aggregate the write
side uses, because a counter's value is per-aggregate state. `listArticles`
folds the whole user stream into one bookmark projection, because a bookmark set
spans articles and has no aggregate of its own. Both mechanisms are in the
codebase on purpose: they show when per-aggregate replay is the right read and
when a projection is.

## Tests

Unit tests cover handlers and read models, property tests cover invariants that
must hold across generated event logs, and the product BDD feature in
`features/product/counter/counter.feature` is exercised by the step definitions
under `test/e2e/steps`.
