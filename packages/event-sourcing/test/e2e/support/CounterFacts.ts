import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import type * as EventSourcing from "../../../src/index.ts";
import type { CounterEvent } from "../../support/Counter.ts";
import { created, incremented, reset } from "../../support/Counter.ts";
import { reject, requiredScenarioValue } from "./EventSourcingWorld.ts";

export type FactRow = {
  readonly fact: string;
  readonly value?: string;
  readonly "stream version"?: string;
  readonly "global position"?: string;
};

export type FactTable = {
  readonly hashes: () => ReadonlyArray<FactRow>;
};

const readNumber = (
  value: string | number | undefined,
  name: string,
): Effect.Effect<number, string> =>
  Effect.flatMap(requiredScenarioValue(value, name), (resolved) => {
    const parsed = Number(resolved);

    if (!Number.isSafeInteger(parsed)) {
      return reject(`${name} must be an integer`);
    }

    return Effect.succeed(parsed);
  });

const rowValue = (row: FactRow, key: keyof FactRow): string | undefined =>
  Fn.pipe(
    row as Readonly<Record<keyof FactRow, string | undefined>>,
    Rec.get(key),
    Option.getOrUndefined,
  );

export const readFactValue = (value: string | number | undefined): Effect.Effect<number, string> =>
  readNumber(value, "fact value");

export const readStreamVersion = (
  value: string | number | undefined,
): Effect.Effect<number, string> => readNumber(value, "stream version");

export const readGlobalPosition = (
  value: string | number | undefined,
): Effect.Effect<number, string> => readNumber(value, "global position");

export const eventFromFact = (fact: string, value?: string): Effect.Effect<CounterEvent, string> =>
  Match.value(fact).pipe(
    Match.when("CounterCreated", () => Effect.succeed(created())),
    Match.when("CounterIncremented", () =>
      Effect.flatMap(readFactValue(value), (factValue) => Effect.succeed(incremented(factValue))),
    ),
    Match.when("CounterReset", () => Effect.succeed(reset())),
    Match.orElse(() => reject(`Unsupported counter fact: ${fact}`)),
  );

export const eventsFromRows = (
  rows: ReadonlyArray<FactRow>,
): Effect.Effect<ReadonlyArray<CounterEvent>, string> =>
  Effect.all(
    Fn.pipe(
      rows,
      Arr.map((row) => eventFromFact(row.fact, row.value)),
    ),
  );

export const storedEventsFromRows = (
  aggregateId: string,
  rows: ReadonlyArray<FactRow>,
): Effect.Effect<ReadonlyArray<EventSourcing.StoredEvent<CounterEvent>>, string> =>
  Effect.all(
    Fn.pipe(
      rows,
      Arr.map((row) =>
        Effect.gen(function* () {
          const aggregateVersion = yield* readStreamVersion(rowValue(row, "stream version"));
          const eventStoreSequenceNumber = yield* readGlobalPosition(
            rowValue(row, "global position"),
          );
          const event = yield* eventFromFact(row.fact, row.value);

          return {
            aggregateId,
            aggregateVersion,
            eventStoreSequenceNumber,
            event,
          };
        }),
      ),
    ),
  );

export const rowsIncludeStoredEventEnvelope = (rows: ReadonlyArray<FactRow>): boolean =>
  Fn.pipe(
    rows,
    Arr.some(
      (row) =>
        rowValue(row, "stream version") !== undefined ||
        rowValue(row, "global position") !== undefined,
    ),
  );
