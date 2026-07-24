import { describe, expect, test } from "bun:test";
import { captureLogs, testEffect } from "@es-ts-example/test-support/TestEffect";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as EventSourcing from "../../src/index.ts";

const at = <A>(records: ReadonlyArray<A>, index: number): A | undefined =>
  Fn.pipe(records, Arr.get(index), Option.getOrUndefined);

const metadataAt = <Event>(
  records: ReadonlyArray<EventSourcing.StoredEvent<Event>>,
  index: number,
): EventSourcing.EventMetadata | undefined =>
  Fn.pipe(records, Arr.get(index), Option.getOrUndefined)?.metadata;

const stripMetadata = <Event>(
  records: ReadonlyArray<EventSourcing.StoredEvent<Event>>,
): ReadonlyArray<Omit<EventSourcing.StoredEvent<Event>, "metadata">> =>
  Fn.pipe(
    records,
    Arr.map(({ metadata: _metadata, ...rest }) => rest),
  );
import {
  CounterEvent,
  type CounterEvent as CounterEventType,
  applyCounterEvent,
  applyNewCounterEvent,
  counterClosed,
  created,
  decideIncrement,
  incremented,
  makeCounterRepository,
  reset,
} from "../support/Counter.ts";

const makeJsonFileCounterEventStore = (path: string) =>
  EventSourcing.makeJsonFileEventStore(CounterEvent, path).pipe(Effect.provide(BunServices.layer));

describe("event-sourcing aggregate core", () => {
  test("folds events into state", () => {
    const foldCounter = EventSourcing.fold(0, applyCounterEvent);

    expect(foldCounter([incremented(2), incremented(3), reset(), incremented(1)])).toBe(1);
  });

  test("creates an empty aggregate at the initial version", () => {
    expect(
      EventSourcing.makeAggregate<number, CounterEventType, "counter-1">("counter-1", 0),
    ).toEqual({
      aggregateId: "counter-1",
      state: 0,
      version: 0,
      pendingEvents: [],
    });
  });

  test("reconstitutes historical events without marking them pending", () => {
    const aggregate = EventSourcing.reconstituteAggregate({
      aggregateId: "counter-1",
      initialState: 0,
      applyEvent: applyCounterEvent,
      events: [incremented(2), incremented(3)],
    });

    expect(aggregate).toEqual({
      aggregateId: "counter-1",
      state: 5,
      version: 2,
      pendingEvents: [],
    });
  });

  test("records new events as pending changes", () => {
    const aggregate = EventSourcing.makeAggregate<number, CounterEventType, "counter-1">(
      "counter-1",
      0,
    );

    expect(applyNewCounterEvent(incremented(2))(aggregate)).toEqual({
      aggregateId: "counter-1",
      state: 2,
      version: 1,
      pendingEvents: [incremented(2)],
    });
  });

  test("preserves existing pending event order when applying another new event", () => {
    const aggregate = EventSourcing.makeAggregate<number, CounterEventType, "counter-1">(
      "counter-1",
      0,
    );

    const changed = applyNewCounterEvent(incremented(3))(
      applyNewCounterEvent(incremented(2))(aggregate),
    );

    expect(changed.state).toBe(5);
    expect(changed.version).toBe(2);
    expect(changed.pendingEvents).toEqual([incremented(2), incremented(3)]);
  });

  test("builds aggregate-specific helpers from a reducer and initial state", () => {
    const factory = EventSourcing.makeAggregateFactory<number, CounterEventType, "counter-1">({
      initialState: 0,
      applyEvent: applyCounterEvent,
    });

    const empty = factory.empty("counter-1");
    const changed = factory.recordEvent(incremented(2))(empty);
    const reconstituted = factory.reconstitute("counter-1")([incremented(2), reset()]);

    expect(empty).toEqual({
      aggregateId: "counter-1",
      state: 0,
      version: 0,
      pendingEvents: [],
    });
    expect(changed).toEqual({
      aggregateId: "counter-1",
      state: 2,
      version: 1,
      pendingEvents: [incremented(2)],
    });
    expect(reconstituted).toEqual({
      aggregateId: "counter-1",
      state: 0,
      version: 2,
      pendingEvents: [],
    });
  });

  test("models domain decisions as accepted events or typed rejections", () => {
    const accepted = EventSourcing.accept([incremented(1)]);
    const rejected = EventSourcing.reject("CounterClosed");

    expect(Result.isSuccess(accepted)).toBe(true);
    expect(Result.isFailure(rejected)).toBe(true);
    expect(accepted).toEqual(Result.succeed([incremented(1)]));
    expect(rejected).toEqual(Result.fail("CounterClosed"));
  });

  test("counter fixture decisions accept open counters and reject closed counters", () => {
    expect(decideIncrement("open", 2)).toEqual(EventSourcing.accept([incremented(2)]));
    expect(decideIncrement("closed", 2)).toEqual(EventSourcing.reject(counterClosed()));
  });
});

describe("in-memory event store", () => {
  testEffect("appends events and fetches them by aggregate id with stream metadata", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(2)],
      });
      yield* store.append({
        aggregateId: "counter-2",
        expectedVersion: 0,
        events: [created()],
      });

      const result = yield* store.fetch({ aggregateId: "counter-1" });

      expect(stripMetadata(result)).toEqual([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
        {
          aggregateId: "counter-1",
          aggregateVersion: 2,
          eventStoreSequenceNumber: 2,
          event: incremented(2),
        },
      ]);
      expect(
        Fn.pipe(
          result,
          Arr.every((record) => record.metadata !== undefined),
        ),
      ).toBe(true);
      expect(at(result, 0)?.metadata?.occurredAt).toHaveProperty("_tag", "Utc");
    }),
  );

  testEffect("rejects appends when the expected version is stale", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
      });

      const error = yield* store
        .append({
          aggregateId: "counter-1",
          expectedVersion: 0,
          events: [incremented(1)],
        })
        .pipe(Effect.flip);

      expect(error).toEqual(
        EventSourcing.ExpectedVersionConflict.make({
          aggregateId: "counter-1",
          expectedVersion: 0,
          actualVersion: 1,
        }),
      );
      expect(error.aggregateId).toBe("counter-1");
      expect(error.expectedVersion).toBe(0);
      expect(error.actualVersion).toBe(1);
    }),
  );

  testEffect("fetches from an inclusive global event-store sequence number", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
      });
      yield* store.append({
        aggregateId: "counter-2",
        expectedVersion: 0,
        events: [created(), incremented(10)],
      });
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 1,
        events: [incremented(2)],
      });

      const result = yield* store.fetch({
        aggregateId: "counter-1",
        startingEventSequenceNumber: 3,
      });

      expect(
        Fn.pipe(
          result,
          Arr.map((record) => record.event),
        ),
      ).toEqual([incremented(2)]);
    }),
  );

  testEffect("can be seeded with existing stored events", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
      ]);

      const result = yield* store.fetch({ aggregateId: "counter-1" });

      expect(result).toEqual([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
      ]);
    }),
  );

  testEffect("stamps a synthetic correlation id when caller omits metadata", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
      });

      const result = yield* store.fetch({ aggregateId: "counter-1" });

      expect(metadataAt(result, 0)?.correlationId).toBe("anonymous-1");
      expect(metadataAt(result, 0)?.causationId).toBeUndefined();
    }),
  );

  testEffect("uses caller-supplied correlation and causation ids when provided", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
        metadata: { correlationId: "trace-42", causationId: "command-7" },
      });

      const result = yield* store.fetch({ aggregateId: "counter-1" });

      expect(metadataAt(result, 0)?.correlationId).toBe("trace-42");
      expect(metadataAt(result, 0)?.causationId).toBe("command-7");
    }),
  );

  testEffect("fetchAll streams every event in global order", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(2)],
      });
      yield* store.append({
        aggregateId: "counter-2",
        expectedVersion: 0,
        events: [created()],
      });

      const result = yield* Stream.runCollect(store.fetchAll({}));

      expect(
        Fn.pipe(
          result,
          Arr.map((record) => record.event),
        ),
      ).toEqual([created(), incremented(2), created()]);
    }),
  );

  testEffect("fetchAll resumes from an inclusive starting sequence number", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(2), incremented(3)],
      });

      const result = yield* Stream.runCollect(store.fetchAll({ startingEventSequenceNumber: 2 }));

      expect(
        Fn.pipe(
          result,
          Arr.map((record) => record.event),
        ),
      ).toEqual([incremented(2), incremented(3)]);
    }),
  );

  testEffect("fetchAll honours the limit parameter", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(1), incremented(2), incremented(3)],
      });

      const result = yield* Stream.runCollect(store.fetchAll({ limit: 2 }));

      expect(result.length).toBe(2);
    }),
  );
});

describe("json file event store", () => {
  const filePathCounter = Effect.runSync(Ref.make(0));
  const filePathRunId = `${process.pid}-${Bun.nanoseconds()}`;
  const filePath = (): string => {
    const n = Effect.runSync(Ref.get(filePathCounter));
    Effect.runSync(Ref.update(filePathCounter, (x) => x + 1));
    return `/tmp/es-ts-example-event-store-${filePathRunId}-${n}.json`;
  };

  testEffect("persists appended events for a later store instance", () =>
    Effect.gen(function* () {
      const path = filePath();
      const store = yield* makeJsonFileCounterEventStore(path);
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(2)],
      });

      const reloaded = yield* makeJsonFileCounterEventStore(path);
      const result = yield* reloaded.fetch({ aggregateId: "counter-1" });

      expect(stripMetadata(result)).toEqual([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
        {
          aggregateId: "counter-1",
          aggregateVersion: 2,
          eventStoreSequenceNumber: 2,
          event: incremented(2),
        },
      ]);
    }),
  );

  testEffect("streams persisted events and rejects stale writes", () =>
    Effect.gen(function* () {
      const store = yield* makeJsonFileCounterEventStore(filePath());
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
      });
      const events = yield* Stream.runCollect(store.fetchAll({ limit: 1 }));
      const error = yield* store
        .append({
          aggregateId: "counter-1",
          expectedVersion: 0,
          events: [incremented(1)],
        })
        .pipe(Effect.flip);

      expect(stripMetadata(events)).toEqual([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
      ]);
      expect(error).toEqual({
        _tag: "ExpectedVersionConflict",
        aggregateId: "counter-1",
        expectedVersion: 0,
        actualVersion: 1,
      });
    }),
  );

  testEffect("streams persisted events without a limit", () =>
    Effect.gen(function* () {
      const store = yield* makeJsonFileCounterEventStore(filePath());
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created()],
      });

      const result = yield* Stream.runCollect(store.fetchAll({}));

      expect(stripMetadata(result)).toEqual([
        {
          aggregateId: "counter-1",
          aggregateVersion: 1,
          eventStoreSequenceNumber: 1,
          event: created(),
        },
      ]);
    }),
  );

  testEffect("fails when persisted json cannot be parsed", () =>
    Effect.gen(function* () {
      const path = filePath();
      yield* Effect.promise(() => Bun.write(path, "not-json"));
      const store = yield* makeJsonFileCounterEventStore(path);

      const error = yield* store.fetch({ aggregateId: "counter-1" }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "EventStorePersistenceFailure",
        message: expect.any(String),
      });
    }),
  );

  testEffect("fails when the event store file cannot be written", () =>
    Effect.gen(function* () {
      const store = yield* makeJsonFileCounterEventStore("/tmp");

      const error = yield* store
        .append({
          aggregateId: "counter-1",
          expectedVersion: 0,
          events: [created()],
        })
        .pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "EventStorePersistenceFailure",
        message: expect.stringContaining("FileSystem"),
      });
    }),
  );

  testEffect("fails when a persisted event record is missing required fields", () =>
    Effect.gen(function* () {
      const path = filePath();
      yield* Effect.promise(() => Bun.write(path, JSON.stringify([{}])));
      const store = yield* makeJsonFileCounterEventStore(path);

      const error = yield* store.fetch({ aggregateId: "counter-1" }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "EventStorePersistenceFailure",
        message: expect.stringContaining("aggregateId"),
      });
    }),
  );

  testEffect("fails when persisted stream metadata is missing required fields", () =>
    Effect.gen(function* () {
      const path = filePath();
      yield* Effect.promise(() =>
        Bun.write(
          path,
          JSON.stringify([
            {
              aggregateId: "counter-1",
              aggregateVersion: 1,
              eventStoreSequenceNumber: 1,
              event: created(),
              metadata: {},
            },
          ]),
        ),
      );
      const store = yield* makeJsonFileCounterEventStore(path);

      const error = yield* store.fetch({ aggregateId: "counter-1" }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "EventStorePersistenceFailure",
        message: expect.stringContaining("correlationId"),
      });
    }),
  );
});

describe("aggregate repository", () => {
  testEffect("loads an aggregate from stored events", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      yield* store.append({
        aggregateId: "counter-1",
        expectedVersion: 0,
        events: [created(), incremented(2)],
      });

      const aggregate = yield* makeCounterRepository(store).load("counter-1");

      expect(aggregate).toEqual({
        aggregateId: "counter-1",
        state: 2,
        version: 2,
        pendingEvents: [],
      });
    }),
  );

  testEffect("saves pending events and returns a clean aggregate", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const repository = makeCounterRepository(store);
      const loaded = yield* repository.load("counter-1");
      const changed = applyNewCounterEvent(incremented(3))(loaded);
      const saved = yield* repository.save(changed);
      const records = yield* store.fetch({ aggregateId: "counter-1" });

      const result = { saved, records };

      expect(result.saved).toEqual({
        aggregateId: "counter-1",
        state: 3,
        version: 1,
        pendingEvents: [],
      });
      expect(
        Fn.pipe(
          result.records,
          Arr.map((record) => record.event),
        ),
      ).toEqual([incremented(3)]);
    }),
  );

  testEffect("commits accepted decisions with metadata", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const repository = makeCounterRepository(store);
      const changed = applyNewCounterEvent(incremented(3))(yield* repository.load("counter-1"));

      const committed = yield* repository.commit(EventSourcing.accept(changed), {
        correlationId: "command-1",
        causationId: "request-1",
      });
      const records = yield* store.fetch({ aggregateId: "counter-1" });

      expect(committed.pendingEvents).toEqual([]);
      expect(records).toHaveLength(1);
      expect(records[0]?.metadata).toMatchObject({
        correlationId: "command-1",
        causationId: "request-1",
      });
    }),
  );

  testEffect("surfaces rejected decisions without saving", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const repository = makeCounterRepository(store);

      const rejection = yield* repository
        .commit(EventSourcing.reject("CounterClosed"))
        .pipe(Effect.flip);
      const records = yield* store.fetch({ aggregateId: "counter-1" });

      expect(rejection).toBe("CounterClosed");
      expect(records).toEqual([]);
    }),
  );

  testEffect("saves pending events without fetching them back", () =>
    Effect.gen(function* () {
      const fetchCountRef = yield* Ref.make(0);
      const appendCommandsRef = yield* Ref.make<
        ReadonlyArray<EventSourcing.AppendEvents<CounterEventType>>
      >([]);
      const store: EventSourcing.EventStore<CounterEventType> = {
        fetch: () =>
          Effect.gen(function* () {
            yield* Ref.update(fetchCountRef, (count) => count + 1);

            return [];
          }),
        fetchAll: () => Stream.empty,
        append: (command) =>
          Effect.gen(function* () {
            yield* Ref.update(appendCommandsRef, (commands) => [...commands, command]);

            return Fn.pipe(
              command.events,
              Arr.map((event, index) => ({
                aggregateId: command.aggregateId,
                aggregateVersion: command.expectedVersion + index + 1,
                eventStoreSequenceNumber: index + 1,
                event,
              })),
            );
          }),
      };
      const repository = makeCounterRepository(store);
      const changed = applyNewCounterEvent(incremented(3))(
        EventSourcing.makeAggregate<number, CounterEventType, "counter-1">("counter-1", 0),
      );
      const saved = yield* repository.save(changed);
      const fetchCount = yield* Ref.get(fetchCountRef);
      const appendCommands = yield* Ref.get(appendCommandsRef);

      const result = { appendCommands, fetchCount, saved };

      expect(result.appendCommands).toEqual([
        {
          aggregateId: "counter-1",
          expectedVersion: 0,
          events: [incremented(3)],
        },
      ]);
      expect(result.fetchCount).toBe(0);
      expect(result.saved).toEqual({
        aggregateId: "counter-1",
        state: 3,
        version: 1,
        pendingEvents: [],
      });
    }),
  );

  testEffect("saving an unchanged aggregate is a no-op", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const repository = makeCounterRepository(store);
      const loaded = yield* repository.load("counter-1");
      const saved = yield* repository.save(loaded);
      const records = yield* store.fetch({ aggregateId: "counter-1" });

      const result = { saved, records };

      expect(result.saved).toEqual({
        aggregateId: "counter-1",
        state: 0,
        version: 0,
        pendingEvents: [],
      });
      expect(result.records).toEqual([]);
    }),
  );

  testEffect("stores aggregates in mapped streams when domain ids overlap", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const first = EventSourcing.makeAggregateRepository({
        store,
        initialState: 0,
        applyEvent: applyCounterEvent,
        streamName: (id: string) => `first:${id}`,
      });
      const second = EventSourcing.makeAggregateRepository({
        store,
        initialState: 0,
        applyEvent: applyCounterEvent,
        streamName: (id: string) => `second:${id}`,
      });

      yield* first.save(applyNewCounterEvent(incremented(1))(yield* first.load("shared-id")));
      yield* second.save(applyNewCounterEvent(incremented(2))(yield* second.load("shared-id")));

      const result = {
        first: yield* first.load("shared-id"),
        second: yield* second.load("shared-id"),
        firstRecords: yield* store.fetch({ aggregateId: "first:shared-id" }),
        secondRecords: yield* store.fetch({ aggregateId: "second:shared-id" }),
      };

      expect(result.first.state).toBe(1);
      expect(result.second.state).toBe(2);
      expect(
        Fn.pipe(
          result.firstRecords,
          Arr.map((record) => record.event),
        ),
      ).toEqual([incremented(1)]);
      expect(
        Fn.pipe(
          result.secondRecords,
          Arr.map((record) => record.event),
        ),
      ).toEqual([incremented(2)]);
    }),
  );

  testEffect("rejects saving stale aggregate copies with optimistic concurrency", () =>
    Effect.gen(function* () {
      const store = yield* EventSourcing.makeInMemoryEventStore<CounterEventType>();
      const repository = makeCounterRepository(store);

      const firstCopy = yield* repository.load("counter-1");
      const secondCopy = yield* repository.load("counter-1");

      yield* repository.save(applyNewCounterEvent(incremented(1))(firstCopy));

      const conflict = yield* repository
        .save(applyNewCounterEvent(incremented(2))(secondCopy))
        .pipe(Effect.flip);

      expect(conflict).toEqual(
        EventSourcing.ExpectedVersionConflict.make({
          aggregateId: "counter-1",
          expectedVersion: 0,
          actualVersion: 1,
        }),
      );
    }),
  );
});

testEffect("main logs package readiness", () =>
  Effect.gen(function* () {
    const messages = yield* captureLogs(EventSourcing.main());

    expect(messages).toEqual(["event-sourcing ready"]);
  }),
);

testEffect("captures multi-part log messages", () =>
  Effect.gen(function* () {
    const messages = yield* captureLogs(Effect.logInfo(["event-sourcing", "ready"]));

    expect(messages).toEqual(["event-sourcing,ready"]);
  }),
);
