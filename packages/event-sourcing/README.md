# @es-ts-example/event-sourcing

This package owns reusable event-sourcing mechanics. It should know nothing
about EsTsExample product language.

## Contract

Aggregates are rebuilt by replaying stored events over an initial state with a
reducer. Decisions produce pending events in memory.

This package provides the aggregate, decision, event-store, projection, and
repository mechanics. Product-specific repository factories belong in
`@es-ts-example/application`; repositories are the boundary that joins aggregates to an
event store.

In this package's BDD features, "fact" means a stored domain event. The Gherkin
vocabulary (fact, stream version, global position, unsaved facts) maps onto the
API names (`event`, `aggregateVersion`, `eventStoreSequenceNumber`,
`pendingEvents`); it is a deliberate readability layer, not a second model.

The important invariant is optimistic concurrency: saving an aggregate appends
only the pending events with the expected version derived from the loaded stream.
If that expected version no longer matches, callers must handle the conflict
instead of silently overwriting history.

## Persistence Boundary

Event stores persist already-decided events. They do not validate business rules,
interpret product invariants, or shape UI read models.

Use the in-memory store for fast tests, the json-file store for local demos, and
the Postgres store for durable runtime storage. Product runtimes consume these
implementations through application-level services.

Import only the package root or declared subpaths: `aggregate`, `decision`,
`event-store`, `postgres-event-store`, `projection`, `projection-store`, and
`repository`. Deep `src` imports bypass the package contract.

## Projections

`projection` folds ordered events into read state. `projection-store` adds
versioned checkpoint persistence for projections. EsTsExample application queries
currently use event folding; the checkpoint store remains a reusable mechanism,
not current product wiring.

## Postgres

Postgres integration tests are opt-in:

```shell
RUN_POSTGRES_TESTS=1 bun --filter @es-ts-example/event-sourcing test:postgres
```

Keep this opt-in unless the default check pipeline also owns the container
lifecycle.

Package-local Effect BDD in `test/e2e` specifies event-store behavior. The
default package `check` runs unit, property, BDD, and mutation tests, but not the
opt-in Postgres integration test above.
