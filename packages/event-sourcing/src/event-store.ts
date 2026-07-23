import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { AggregateId, AggregateVersion } from "./aggregate.ts";

export type EventStoreSequenceNumber = number;
export type CorrelationId = string;
export type CausationId = string;

export type EventMetadata = {
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly occurredAt: DateTime.Utc;
};

export type StoredEvent<Event> = {
  readonly aggregateId: AggregateId;
  readonly aggregateVersion: AggregateVersion;
  readonly eventStoreSequenceNumber: EventStoreSequenceNumber;
  readonly event: Event;
  /**
   * Optional in the type so historical seed data and lightweight test fixtures
   * can omit it; the in-memory store *always* stamps metadata on append, so
   * any record produced through the normal write path will have it set.
   */
  readonly metadata?: EventMetadata;
};

export type AppendMetadata = {
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
};

export type AppendEvents<Event> = {
  readonly aggregateId: AggregateId;
  readonly expectedVersion: AggregateVersion;
  readonly events: ReadonlyArray<Event>;
  /**
   * Optional in the framework so existing callers compile. Production callers
   * should always set a real `correlationId`; when omitted, the in-memory
   * store stamps a synthetic one (`anonymous-<sequence>`) so traceability is
   * still total — never `undefined`.
   */
  readonly metadata?: AppendMetadata;
};

/**
 * `startingEventSequenceNumber` is an **inclusive** lower bound. After
 * processing event N, persist `lastEventStoreSequenceNumber = N` and resume
 * reads with `startingEventSequenceNumber = N + 1`.
 */
export type FetchEvents = {
  readonly aggregateId: AggregateId;
  readonly startingEventSequenceNumber?: EventStoreSequenceNumber;
};

/**
 * Global cross-aggregate read. Same inclusive-lower-bound contract as
 * {@link FetchEvents}. `limit`, when set, caps the number of events returned
 * by the underlying stream so callers can page through arbitrarily large
 * histories without unbounded buffering.
 */
export type FetchAllEvents = {
  readonly startingEventSequenceNumber?: EventStoreSequenceNumber;
  readonly limit?: number;
};

export const ExpectedVersionConflict = Schema.TaggedStruct("ExpectedVersionConflict", {
  aggregateId: Schema.String,
  expectedVersion: Schema.Number,
  actualVersion: Schema.Number,
});
export type ExpectedVersionConflict = {
  readonly _tag: "ExpectedVersionConflict";
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
};

export const EventStorePersistenceFailure = Schema.TaggedStruct("EventStorePersistenceFailure", {
  message: Schema.String,
});
export type EventStorePersistenceFailure = {
  readonly _tag: "EventStorePersistenceFailure";
  readonly message: string;
};

const eventStorePersistenceFailure = (error: unknown): EventStorePersistenceFailure =>
  EventStorePersistenceFailure.make({
    message: error instanceof Error ? error.message : String(error),
  });

const EventMetadata = Schema.Struct({
  correlationId: Schema.String,
  causationId: Schema.optionalKey(Schema.String),
  occurredAt: Schema.DateTimeUtcFromString,
});

const StoredEvent = <Event>(event: Schema.Codec<Event, unknown>) =>
  Schema.Struct({
    aggregateId: Schema.String,
    aggregateVersion: Schema.Number,
    eventStoreSequenceNumber: Schema.Number,
    event,
    metadata: Schema.optionalKey(EventMetadata),
  });

const StoredEvents = <Event>(event: Schema.Codec<Event, unknown>) =>
  Schema.Array(StoredEvent(event));

export type EventStore<Event, Error = never> = {
  readonly fetch: (query: FetchEvents) => Effect.Effect<ReadonlyArray<StoredEvent<Event>>, Error>;
  readonly fetchAll: (query: FetchAllEvents) => Stream.Stream<StoredEvent<Event>, Error>;
  readonly append: (
    command: AppendEvents<Event>,
  ) => Effect.Effect<ReadonlyArray<StoredEvent<Event>>, ExpectedVersionConflict | Error>;
};

const aggregateVersionInRecords = <Event>(
  records: ReadonlyArray<StoredEvent<Event>>,
  aggregateId: AggregateId,
): AggregateVersion =>
  Fn.pipe(
    records,
    Arr.filter((record) => record.aggregateId === aggregateId),
    Arr.length,
  );

const recordsForAggregate = <Event>(
  records: ReadonlyArray<StoredEvent<Event>>,
  query: FetchEvents,
): ReadonlyArray<StoredEvent<Event>> =>
  Fn.pipe(
    records,
    Arr.filter(
      (record) =>
        record.aggregateId === query.aggregateId &&
        record.eventStoreSequenceNumber >= (query.startingEventSequenceNumber ?? 1),
    ),
  );

const recordsFromSequenceNumber = <Event>(
  records: ReadonlyArray<StoredEvent<Event>>,
  query: FetchAllEvents,
): ReadonlyArray<StoredEvent<Event>> =>
  Fn.pipe(
    records,
    Arr.filter(
      (record) => record.eventStoreSequenceNumber >= (query.startingEventSequenceNumber ?? 1),
    ),
  );

export const storedEventsForAppend = <Event>(options: {
  readonly command: AppendEvents<Event>;
  readonly startVersion: AggregateVersion;
  readonly startSequenceNumber: EventStoreSequenceNumber;
  readonly occurredAt: DateTime.Utc;
}): ReadonlyArray<StoredEvent<Event>> => {
  const correlationId =
    options.command.metadata?.correlationId ?? `anonymous-${options.startSequenceNumber + 1}`;
  const causationId = options.command.metadata?.causationId;
  return Fn.pipe(
    options.command.events,
    Arr.map((event, index) => ({
      aggregateId: options.command.aggregateId,
      aggregateVersion: options.startVersion + index + 1,
      eventStoreSequenceNumber: options.startSequenceNumber + index + 1,
      event,
      metadata: {
        correlationId,
        occurredAt: options.occurredAt,
        ...(causationId === undefined ? {} : { causationId }),
      },
    })),
  );
};

export const makeInMemoryEventStore = <Event>(
  seed?: ReadonlyArray<StoredEvent<Event>>,
): Effect.Effect<EventStore<Event>> =>
  Effect.gen(function* () {
    const initialEvents = seed ?? [];
    const storedEventsRef = yield* Ref.make(initialEvents);

    const fetchAll = (query: FetchAllEvents): Stream.Stream<StoredEvent<Event>> => {
      const iterableEffect = Fn.pipe(
        Ref.get(storedEventsRef),
        Effect.map((records) => recordsFromSequenceNumber(records, query)),
      );
      const base = Stream.fromIterableEffect(iterableEffect);
      return Fn.pipe(
        Option.fromUndefinedOr(query.limit),
        Option.match({
          onNone: () => base,
          onSome: (limit) => Fn.pipe(base, Stream.take(limit)),
        }),
      );
    };

    return {
      fetch: (query) =>
        Fn.pipe(
          Ref.get(storedEventsRef),
          Effect.map((records) => recordsForAggregate(records, query)),
        ),
      fetchAll,
      append: (command) =>
        Effect.gen(function* () {
          const records = yield* Ref.get(storedEventsRef);
          const actualVersion = aggregateVersionInRecords(records, command.aggregateId);

          if (actualVersion !== command.expectedVersion) {
            return yield* Effect.fail(
              ExpectedVersionConflict.make({
                aggregateId: command.aggregateId,
                expectedVersion: command.expectedVersion,
                actualVersion,
              }),
            );
          }

          const occurredAt = yield* DateTime.now;
          const stored = storedEventsForAppend({
            command,
            startVersion: actualVersion,
            startSequenceNumber: Arr.length(records),
            occurredAt,
          });
          yield* Ref.update(storedEventsRef, Arr.appendAll(stored));

          return stored;
        }),
    };
  });

const parseJson = (contents: string): Effect.Effect<unknown, EventStorePersistenceFailure> =>
  Effect.try({
    try: () => JSON.parse(contents),
    catch: eventStorePersistenceFailure,
  });

const parseStoredEventRecords = <Event>(
  event: Schema.Codec<Event, unknown>,
  contents: string,
): Effect.Effect<ReadonlyArray<StoredEvent<Event>>, EventStorePersistenceFailure> =>
  Fn.pipe(
    parseJson(contents),
    Effect.flatMap(Schema.decodeUnknownEffect(StoredEvents(event))),
    Effect.mapError(eventStorePersistenceFailure),
  );

const writeJsonFileRecords = <Event>(
  event: Schema.Codec<Event, unknown>,
  fs: FileSystem.FileSystem,
  path: string,
  records: ReadonlyArray<StoredEvent<Event>>,
): Effect.Effect<void, EventStorePersistenceFailure> =>
  Fn.pipe(
    Schema.encodeUnknownEffect(StoredEvents(event))(records),
    Effect.map((encoded) => JSON.stringify(encoded, null, 2)),
    Effect.flatMap((contents) => fs.writeFileString(path, contents)),
    Effect.mapError(eventStorePersistenceFailure),
  );

const readJsonFileRecords =
  <Event>(event: Schema.Codec<Event, unknown>) =>
  (
    fs: FileSystem.FileSystem,
    path: string,
  ): Effect.Effect<ReadonlyArray<StoredEvent<Event>>, EventStorePersistenceFailure> =>
    Effect.gen(function* () {
      const exists = yield* fs.exists(path).pipe(Effect.mapError(eventStorePersistenceFailure));
      if (!exists) {
        return [];
      }

      const contents = yield* fs
        .readFileString(path, "utf8")
        .pipe(Effect.mapError(eventStorePersistenceFailure));
      return yield* parseStoredEventRecords(event, contents);
    });

export const makeJsonFileEventStore = <Event>(
  event: Schema.Codec<Event, unknown>,
  path: string,
): Effect.Effect<EventStore<Event, EventStorePersistenceFailure>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const readRecords = readJsonFileRecords(event);

    const store: EventStore<Event, EventStorePersistenceFailure> = {
      fetch: (query: FetchEvents) =>
        Fn.pipe(
          readRecords(fs, path),
          Effect.map((records) => recordsForAggregate(records, query)),
        ),
      fetchAll: (query: FetchAllEvents) => {
        const base = Stream.fromIterableEffect(
          Fn.pipe(
            readRecords(fs, path),
            Effect.map((records) => recordsFromSequenceNumber(records, query)),
          ),
        );
        return Fn.pipe(
          Option.fromUndefinedOr(query.limit),
          Option.match({
            onNone: () => base,
            onSome: (limit) => Fn.pipe(base, Stream.take(limit)),
          }),
        );
      },
      append: (command: AppendEvents<Event>) =>
        Effect.gen(function* () {
          const records = yield* readRecords(fs, path);
          const actualVersion = aggregateVersionInRecords(records, command.aggregateId);

          if (actualVersion !== command.expectedVersion) {
            return yield* Effect.fail(
              ExpectedVersionConflict.make({
                aggregateId: command.aggregateId,
                expectedVersion: command.expectedVersion,
                actualVersion,
              }),
            );
          }

          const occurredAt = yield* DateTime.now;
          const stored = storedEventsForAppend({
            command,
            startVersion: actualVersion,
            startSequenceNumber: Arr.length(records),
            occurredAt,
          });
          yield* writeJsonFileRecords(event, fs, path, Fn.pipe(records, Arr.appendAll(stored)));

          return stored;
        }),
    };
    return store;
  });
