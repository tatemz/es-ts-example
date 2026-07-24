import { describe, expect, test } from "bun:test";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Persistence from "effect/unstable/persistence";
import * as EventSourcing from "../../src/index.ts";

type CounterTotalsState = {
  readonly totalIncremented: number;
  readonly totalDecremented: number;
};

type AnyEvent =
  | { readonly _tag: "Incremented"; readonly by: number }
  | { readonly _tag: "Decremented"; readonly by: number }
  | { readonly _tag: "OtherDomainEvent"; readonly note: string };

type ProjectionEvent = Extract<AnyEvent, { readonly _tag: "Incremented" | "Decremented" }>;

const initialState: CounterTotalsState = {
  totalIncremented: 0,
  totalDecremented: 0,
};

const countTotals = (state: CounterTotalsState, event: ProjectionEvent): CounterTotalsState =>
  Match.valueTags(event, {
    Incremented: (incremented) => ({
      ...state,
      totalIncremented: state.totalIncremented + incremented.by,
    }),
    Decremented: (decremented) => ({
      ...state,
      totalDecremented: state.totalDecremented + decremented.by,
    }),
  });

const selectCounterEvent = (event: AnyEvent): Option.Option<ProjectionEvent> =>
  Schema.is(ProjectionEventSchema)(event) ? Option.some(event) : Option.none();

const projection = EventSourcing.makeProjection<
  CounterTotalsState,
  ProjectionEvent,
  AnyEvent,
  "counter-totals"
>({
  projectionId: "counter-totals",
  initialState,
  reducer: countTotals,
  matchesProjection: selectCounterEvent,
});

describe("projection primitives", () => {
  test("initialCheckpoint captures the initial state and sequence 0", () => {
    expect(EventSourcing.initialCheckpoint(initialState)).toEqual({
      state: initialState,
      lastEventStoreSequenceNumber: 0,
    });
  });

  test("replayProjection ignores unselected events and folds the rest", () => {
    const events: ReadonlyArray<AnyEvent> = [
      { _tag: "Incremented", by: 3 },
      { _tag: "OtherDomainEvent", note: "ignored" },
      { _tag: "Decremented", by: 1 },
      { _tag: "Incremented", by: 4 },
    ];

    expect(EventSourcing.replayProjection(projection)(events)).toEqual({
      totalIncremented: 7,
      totalDecremented: 1,
    });
  });

  test("makeProjection round-trips its options", () => {
    expect(projection.projectionId).toBe("counter-totals");
    expect(projection.initialState).toEqual(initialState);
    expect(projection.reducer(initialState, { _tag: "Incremented", by: 2 })).toEqual({
      totalIncremented: 2,
      totalDecremented: 0,
    });
    expect(projection.matchesProjection({ _tag: "Incremented", by: 1 })).toEqual(
      Option.some({ _tag: "Incremented", by: 1 }),
    );
    expect(projection.matchesProjection({ _tag: "OtherDomainEvent", note: "skip" })).toEqual(
      Option.none(),
    );
  });
});

const StateSchema: Schema.Codec<CounterTotalsState> = Schema.Struct({
  totalIncremented: Schema.Number,
  totalDecremented: Schema.Number,
});

const Incremented = Schema.TaggedStruct("Incremented", {
  by: Schema.Number,
});
const Decremented = Schema.TaggedStruct("Decremented", {
  by: Schema.Number,
});
const ProjectionEventSchema = Schema.Union([Incremented, Decremented]);

const ProjectionEnvelopeSchema: Schema.Codec<
  EventSourcing.ProjectionCheckpoint<CounterTotalsState>
> = Schema.Struct({
  state: StateSchema,
  lastEventStoreSequenceNumber: Schema.Number,
});

const VersionedEnvelopeSchema: Schema.Codec<
  EventSourcing.Versioned<EventSourcing.ProjectionCheckpoint<CounterTotalsState>>
> = Schema.Struct({
  value: ProjectionEnvelopeSchema,
  version: Schema.Number,
});

const makeTestSchemaStore = <S extends Schema.Top>(
  schema: S,
): Persistence.KeyValueStore.SchemaStore<S> => {
  const backing = new Map<string, string>();
  const raw = Persistence.KeyValueStore.makeStringOnly({
    get: (key) => Effect.sync(() => backing.get(key)),
    set: (key, value) =>
      Effect.sync(() => {
        backing.set(key, value);
      }),
    remove: (key) =>
      Effect.sync(() => {
        backing.delete(key);
      }),
    clear: Effect.sync(() => {
      backing.clear();
    }),
    size: Effect.sync(() => backing.size),
  });

  return Persistence.KeyValueStore.toSchemaStore(raw, schema);
};

describe("projection store", () => {
  testEffect("load returns the initial envelope at version 0 when the projection is absent", () =>
    Effect.gen(function* () {
      const schemaStore = makeTestSchemaStore(VersionedEnvelopeSchema);
      const store = EventSourcing.makeProjectionStore({ schemaStore, initialState });

      const result = yield* store.load("counter-totals");

      expect(result).toEqual({
        value: { state: initialState, lastEventStoreSequenceNumber: 0 },
        version: 0,
      });
    }),
  );

  testEffect("save writes a new envelope at version 1 starting from expectedVersion 0", () =>
    Effect.gen(function* () {
      const schemaStore = makeTestSchemaStore(VersionedEnvelopeSchema);
      const store = EventSourcing.makeProjectionStore({ schemaStore, initialState });
      const envelope: EventSourcing.ProjectionCheckpoint<CounterTotalsState> = {
        state: { totalIncremented: 4, totalDecremented: 1 },
        lastEventStoreSequenceNumber: 7,
      };
      const saved = yield* store.save("counter-totals", envelope, 0);
      const reloaded = yield* store.load("counter-totals");
      const conflict = yield* store.save("counter-totals", envelope, 0).pipe(Effect.flip);
      const conflictFields =
        conflict instanceof EventSourcing.ProjectionStoreVersionConflict
          ? {
              _tag: conflict._tag,
              projectionId: conflict.projectionId,
              expectedVersion: conflict.expectedVersion,
              actualVersion: conflict.actualVersion,
              isConflict: true,
            }
          : {
              _tag: conflict._tag,
              projectionId: "",
              expectedVersion: -1,
              actualVersion: -1,
              isConflict: false,
            };

      const result = { saved, reloaded };

      expect(result.saved.version).toBe(1);
      expect(result.reloaded.version).toBe(1);
      expect(result.reloaded.value.state).toEqual({ totalIncremented: 4, totalDecremented: 1 });
      expect(result.reloaded.value.lastEventStoreSequenceNumber).toBe(7);
      expect(conflictFields).toEqual({
        _tag: "ProjectionStoreVersionConflict",
        projectionId: "counter-totals",
        expectedVersion: 0,
        actualVersion: 1,
        isConflict: true,
      });
    }),
  );

  testEffect("save fails with ProjectionStoreVersionConflict on stale expected version", () =>
    Effect.gen(function* () {
      const schemaStore = makeTestSchemaStore(VersionedEnvelopeSchema);
      const store = EventSourcing.makeProjectionStore({ schemaStore, initialState });
      const envelope: EventSourcing.ProjectionCheckpoint<CounterTotalsState> = {
        state: initialState,
        lastEventStoreSequenceNumber: 0,
      };
      yield* store.save("counter-totals", envelope, 0);

      const conflict = yield* store.save("counter-totals", envelope, 0).pipe(Effect.flip);

      expect(conflict).toEqual(
        new EventSourcing.ProjectionStoreVersionConflict({
          projectionId: "counter-totals",
          expectedVersion: 0,
          actualVersion: 1,
        }),
      );
      expect(conflict).toBeInstanceOf(EventSourcing.ProjectionStoreVersionConflict);
      expect(Predicate.isTagged("ProjectionStoreVersionConflict")(conflict)).toBe(true);
      const typedConflict = conflict as EventSourcing.ProjectionStoreVersionConflict;
      expect(typedConflict.projectionId).toBe("counter-totals");
      expect(typedConflict.expectedVersion).toBe(0);
      expect(typedConflict.actualVersion).toBe(1);
    }),
  );
});
