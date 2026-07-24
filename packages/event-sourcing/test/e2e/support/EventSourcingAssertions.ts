import assert from "node:assert/strict";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as EventSourcing from "../../../src/index.ts";
import type { CounterEvent } from "../../support/Counter.ts";
import { incremented } from "../../support/Counter.ts";
import {
  eventsFromRows,
  type FactRow,
  rowsIncludeStoredEventEnvelope,
  storedEventsFromRows,
} from "./CounterFacts.ts";
import {
  type EventSourcingScenarioState,
  requiredScenarioValue,
  runSync,
} from "./EventSourcingWorld.ts";

export const fetchRecords = (
  store: EventSourcing.EventStore<CounterEvent>,
  aggregateId: string,
): ReadonlyArray<EventSourcing.StoredEvent<CounterEvent>> => runSync(store.fetch({ aggregateId }));

export const recordsForAssertion = (
  state: EventSourcingScenarioState,
  aggregateId: string,
): Effect.Effect<ReadonlyArray<EventSourcing.StoredEvent<CounterEvent>>, string> =>
  state.fetchedStream === aggregateId && state.fetchedRecords !== undefined
    ? requiredScenarioValue(state.fetchedRecords, "fetchedRecords")
    : Effect.flatMap(requiredScenarioValue(state.store, "store"), (store) =>
        Effect.sync(() => fetchRecords(store, aggregateId)),
      );

export const appendEvents = (
  state: EventSourcingScenarioState,
  aggregateId: string,
  expectedVersion: number,
  events: ReadonlyArray<CounterEvent>,
): Effect.Effect<
  ReadonlyArray<EventSourcing.StoredEvent<CounterEvent>>,
  string | EventSourcing.ExpectedVersionConflict
> =>
  Effect.flatMap(requiredScenarioValue(state.store, "store"), (store) =>
    store.append({
      aggregateId,
      expectedVersion,
      events,
    }),
  );

export const assertCleanAggregate = (
  aggregate: EventSourcing.Aggregate<number, CounterEvent>,
  state: number,
  version: number,
) => {
  assert.equal(aggregate.state, state);
  assert.equal(aggregate.version, version);
  assert.deepEqual(aggregate.pendingEvents, []);
};

export const assertPendingEvents = (
  aggregate: EventSourcing.Aggregate<number, CounterEvent>,
  rows: ReadonlyArray<FactRow>,
): Effect.Effect<void, string> =>
  Effect.flatMap(eventsFromRows(rows), (expected) =>
    Effect.sync(() => {
      assert.deepEqual(aggregate.pendingEvents, expected);
    }),
  );

export const assertStreamContainsFacts = (
  state: EventSourcingScenarioState,
  aggregateId: string,
  rows: ReadonlyArray<FactRow>,
): Effect.Effect<void, string> =>
  Effect.gen(function* () {
    const records = yield* recordsForAssertion(state, aggregateId);

    if (rowsIncludeStoredEventEnvelope(rows)) {
      const expected = yield* storedEventsFromRows(aggregateId, rows);

      assert.deepEqual(records, expected);
      return;
    }

    const expected = yield* eventsFromRows(rows);

    assert.deepEqual(
      Fn.pipe(
        records,
        Arr.map((record) => record.event),
      ),
      expected,
    );
  });

export const assertStreamContainsOnlyCreated = (
  store: EventSourcing.EventStore<CounterEvent>,
  aggregateId: string,
) => {
  assert.deepEqual(
    Fn.pipe(
      fetchRecords(store, aggregateId),
      Arr.map((record) => record.event),
    ),
    [{ _tag: "CounterCreated" }],
  );
};

export const assertIsolatedRepositoryFacts = (
  store: EventSourcing.EventStore<CounterEvent>,
  expectations: ReadonlyArray<readonly [string, ReadonlyArray<CounterEvent>]>,
) => {
  assert.deepEqual(
    Fn.pipe(
      expectations,
      Arr.map(([aggregateId]) =>
        Fn.pipe(
          fetchRecords(store, aggregateId),
          Arr.map((record) => record.event),
        ),
      ),
    ),
    Fn.pipe(
      expectations,
      Arr.map(([, events]) => events),
    ),
  );
};

export const assertIncrementPending = (
  aggregate: EventSourcing.Aggregate<number, CounterEvent>,
  by: number,
) => {
  assert.deepEqual(aggregate.pendingEvents, [incremented(by)]);
};

export const assertCounterState = (
  aggregate: EventSourcing.Aggregate<number, CounterEvent>,
  state: number,
) => {
  assert.equal(aggregate.state, state);
};

export const assertCounterVersion = (
  aggregate: EventSourcing.Aggregate<number, CounterEvent>,
  version: number,
) => {
  assert.equal(aggregate.version, version);
};

export const assertNoPendingEvents = (aggregate: EventSourcing.Aggregate<number, CounterEvent>) => {
  assert.deepEqual(aggregate.pendingEvents, []);
};

export const assertDecisionAccepted = <A, E>(
  decision: Result.Result<A, E>,
  expected: Result.Result<A, E>,
) => {
  assert.equal(Result.isSuccess(decision), true);
  assert.deepEqual(decision, expected);
};

export const assertDecisionRejectedWith = <A, E>(
  decision: Result.Result<A, E>,
  expected: Result.Result<A, E>,
) => {
  assert.equal(Result.isFailure(decision), true);
  assert.deepEqual(decision, expected);
};

export const assertDecisionRejected = <A, E>(decision: Result.Result<A, E>) => {
  assert.equal(Result.isFailure(decision), true);
};

export const assertStreamEmpty = (
  state: EventSourcingScenarioState,
  aggregateId: string,
): Effect.Effect<void, string> =>
  Effect.flatMap(recordsForAssertion(state, aggregateId), (records) =>
    Effect.sync(() => {
      assert.deepEqual(records, []);
    }),
  );

export const assertStreamVersion = (actual: number, expected: number) => {
  assert.equal(actual, expected);
};

export const assertExpectedVersionConflict = (conflict: unknown) => {
  assert.ok(Schema.is(EventSourcing.ExpectedVersionConflict)(conflict));
};

export const assertConflictVersions = (
  conflict: { readonly expectedVersion: number; readonly actualVersion: number },
  expectedVersion: number,
  actualVersion: number,
) => {
  assert.equal(conflict.expectedVersion, expectedVersion);
  assert.equal(conflict.actualVersion, actualVersion);
};
