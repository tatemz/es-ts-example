import { expect, test } from "bun:test";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as FastCheck from "effect/testing/FastCheck";
import * as EventSourcing from "../../src/index.ts";
import {
  type CounterEvent,
  applyCounterEvent,
  recordNewCounterEvent,
  incremented,
  reset,
} from "../support/Counter.ts";

const largestIncrementMagnitude = 1_000;
const firstEventSequenceNumber = 1;
const initialStreamVersion = 0;

const counterEvent = FastCheck.oneof(
  FastCheck.integer({ min: -largestIncrementMagnitude, max: largestIncrementMagnitude }).chain(
    (value) => FastCheck.constant(incremented(value)),
  ),
  FastCheck.constant(reset()),
);

const counterEvents = FastCheck.array(counterEvent, { maxLength: 20 });

const nonEmptyCounterEvents = FastCheck.array(counterEvent, {
  minLength: 1,
  maxLength: 20,
});

test("property: fold and aggregate replay derive the same state", () => {
  FastCheck.assert(
    FastCheck.property(counterEvents, (events) => {
      const foldedState = EventSourcing.replayInto(0, applyCounterEvent)(events);
      const aggregate = EventSourcing.replayAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        reducer: applyCounterEvent,
        events,
      });

      expect(aggregate.state).toBe(foldedState);
    }),
    propertyTestParameters,
  );
});

test("property: replayed aggregate version equals historical event count", () => {
  FastCheck.assert(
    FastCheck.property(counterEvents, (events) => {
      const aggregate = EventSourcing.replayAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        reducer: applyCounterEvent,
        events,
      });

      expect(aggregate.version).toBe(events.length);
    }),
    propertyTestParameters,
  );
});

test("property: historical events are never pending persistence", () => {
  FastCheck.assert(
    FastCheck.property(counterEvents, (events) => {
      const aggregate = EventSourcing.replayAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        reducer: applyCounterEvent,
        events,
      });

      expect(aggregate.pendingEvents).toEqual([]);
    }),
    propertyTestParameters,
  );
});

test("property: new aggregate changes keep exactly the new pending events", () => {
  FastCheck.assert(
    FastCheck.property(counterEvents, counterEvents, (history, newEvents) => {
      const aggregate = EventSourcing.replayAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        reducer: applyCounterEvent,
        events: history,
      });
      const changed = Fn.pipe(
        newEvents,
        Arr.reduce(aggregate, (current, event) => recordNewCounterEvent(event)(current)),
      );

      expect(changed.pendingEvents).toEqual(newEvents);
      expect(changed.version).toBe(history.length + newEvents.length);
      expect(changed.state).toBe(
        EventSourcing.replayInto(0, applyCounterEvent)([...history, ...newEvents]),
      );
    }),
    propertyTestParameters,
  );
});

test("property: appending and fetching preserves event order and stream versions", () => {
  FastCheck.assert(
    FastCheck.property(counterEvents, (events) => {
      const records = Effect.runSync(
        Effect.gen(function* () {
          const store = yield* EventSourcing.makeInMemoryEventStore<CounterEvent>();
          yield* store.append({
            aggregateId: "counter-1",
            expectedVersion: 0,
            events,
          });

          return yield* store.fetch({ aggregateId: "counter-1" });
        }),
      );

      expect(
        Fn.pipe(
          records,
          Arr.map((record) => record.event),
        ),
      ).toEqual(events);
      expect(
        Fn.pipe(
          records,
          Arr.map((record) => record.aggregateVersion),
        ),
      ).toEqual(
        Fn.pipe(
          events,
          Arr.map((_, index) => index + 1),
        ),
      );
      expect(
        Fn.pipe(
          records,
          Arr.map((record) => record.eventStoreSequenceNumber),
        ),
      ).toEqual(
        Fn.pipe(
          events,
          Arr.map((_, index) => index + 1),
        ),
      );
    }),
    propertyTestParameters,
  );
});

test("property: fetchAll resumed at lastSeen + 1 never overlaps the prior page", () => {
  FastCheck.assert(
    FastCheck.property(
      nonEmptyCounterEvents.chain((events) =>
        FastCheck.tuple(
          FastCheck.constant(events),
          FastCheck.integer({ min: firstEventSequenceNumber, max: events.length }),
        ),
      ),
      ([events, splitAt]) => {
        const result = Effect.runSync(
          Effect.gen(function* () {
            const store = yield* EventSourcing.makeInMemoryEventStore<CounterEvent>();
            yield* store.append({
              aggregateId: "counter-1",
              expectedVersion: 0,
              events,
            });

            const firstPage = yield* Stream.runCollect(store.fetchAll({ limit: splitAt }));
            const lastSeen =
              Fn.pipe(firstPage, Arr.last, Option.getOrUndefined)?.eventStoreSequenceNumber ?? 0;
            const secondPage = yield* Stream.runCollect(
              store.fetchAll({ startingEventSequenceNumber: lastSeen + 1 }),
            );

            return { firstPage, secondPage };
          }),
        );

        const firstSeqs = Fn.pipe(
          result.firstPage,
          Arr.map((record) => record.eventStoreSequenceNumber),
        );
        const secondSeqs = Fn.pipe(
          result.secondPage,
          Arr.map((record) => record.eventStoreSequenceNumber),
        );
        const overlap = Fn.pipe(
          secondSeqs,
          Arr.filter((seq) => Fn.pipe(firstSeqs, Arr.contains(seq))),
        );

        expect(overlap).toEqual([]);
        expect([...firstSeqs, ...secondSeqs]).toEqual(
          Fn.pipe(
            events,
            Arr.map((_, index) => index + 1),
          ),
        );
      },
    ),
    propertyTestParameters,
  );
});

test("property: stale expected versions always produce conflicts", () => {
  FastCheck.assert(
    FastCheck.property(
      nonEmptyCounterEvents.chain((events) =>
        FastCheck.tuple(
          FastCheck.constant(events),
          FastCheck.integer({ min: initialStreamVersion, max: events.length - 1 }),
        ),
      ),
      ([events, expectedVersion]) => {
        const conflict = Effect.runSync(
          Effect.gen(function* () {
            const store = yield* EventSourcing.makeInMemoryEventStore<CounterEvent>();
            yield* store.append({
              aggregateId: "counter-1",
              expectedVersion: 0,
              events,
            });

            return yield* store
              .append({
                aggregateId: "counter-1",
                expectedVersion,
                events: [incremented(1)],
              })
              .pipe(Effect.flip);
          }),
        );

        expect(conflict).toEqual(
          EventSourcing.ExpectedVersionConflict.make({
            aggregateId: "counter-1",
            expectedVersion,
            actualVersion: events.length,
          }),
        );
      },
    ),
    propertyTestParameters,
  );
});
