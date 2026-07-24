# @es-ts-example/domain

This package owns pure business decisions for two bounded contexts: `counter`
and `user`. A decision must be understandable from state, events, rejections,
and reducer logic alone: no HTTP, storage, browser APIs, or provider DTOs.

## Reading Order

Each context folder holds the same six files. Read them in this order:

1. `State.ts` — the tagged states a context can be in, and the value bounds
   those states enforce.
2. `Events.ts` — the facts that have already happened. Events are never
   rejected; they are history.
3. `Reducer.ts` — how one event moves one state to the next.
4. `Aggregate.ts` — the state plus its version and pending events.
5. `Rejections.ts` — the tagged reasons a decision can say no. The `user`
   context has no rejection file because `toggleArticleBookmark` cannot fail.
6. `Decisions.ts` — the decisions themselves, named for the command rather than
   the event: `toggleArticleBookmark` records `ArticleBookmarked`.

## Boundary

Production code may depend only on Effect and the aggregate and decision
contracts from `@es-ts-example/event-sourcing`. The two contexts are isolated:
neither imports the other. External SDKs, HTTP calls, browser APIs, runtime
configuration, and persistence belong outside this package.

`index.ts` re-exports both contexts and the `DomainEvent` union that the
application layer persists. That union is the one place the contexts meet.

## The Reducer Must Survive Logs It Did Not Write

A decision only ever sees state that its own rules produced. A reducer does not
get that guarantee: it replays whatever is in the stream, including events
written by an older version of the code, hand-edited files, or another context's
stream read by mistake.

So `applyCounterEvent` branches on state first and lets each state name what it
accepts. `CounterNotCreated` ignores everything but `CounterCreated`, so replay
cannot fabricate a counter that was never created. `DisabledCounter` ignores
every event, so "disable freezes the counter" holds during replay and not only
at decision time. The value is clamped rather than validated, because
`ActiveCounter.make` throws outside `0..5` and a reducer is the worst possible
place to throw.

The property tests in `test/property` generate arbitrary logs, in orders the
decisions would never produce, and assert exactly these three invariants.

## Rejections Are Tagged, Not Generic

Decisions return precise tagged rejections such as `CounterIsDisabled` and
`CounterMaximumReached`. Callers branch on the tag. Do not collapse them into a
single command-failed error: the application layer maps each tag to its own RPC
failure and the web layer maps each failure to its own message.

## Tests

Unit tests carry decision examples, property tests carry broad invariants, and
Effect BDD carries product behavior. The feature file lives in
`features/product/counter/counter.feature`; the step definitions that bind it to
these decisions live in `test/e2e/steps`.
