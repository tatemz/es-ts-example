import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import * as Stream from "effect/Stream";
import { type CounterList, counterReadFromAggregate } from "../readModels.ts";
import type { CounterEventStore } from "../repository.ts";

export const makeListCountersHandler =
  (store: CounterEventStore) =>
  (): Effect.Effect<CounterList, EventStore.EventStorePersistenceFailure> =>
    Fn.pipe(
      store.fetchAll({}),
      Stream.runCollect,
      Effect.map((records) => ({
        counters: Fn.pipe(
          records,
          Arr.groupBy((record) => record.event.counterId),
          Rec.toEntries,
          Arr.map(([counterId, group]) =>
            counterReadFromAggregate(
              Domain.reconstituteCounter(Domain.CounterId.make(counterId))(
                Arr.map(group, (record) => record.event),
              ),
            ),
          ),
        ),
      })),
    );
