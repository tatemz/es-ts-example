import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import type { Aggregate, AggregateId, Reducer } from "./aggregate.ts";
import { reconstituteAggregate } from "./aggregate.ts";
import type { AppendMetadata, EventStore, ExpectedVersionConflict } from "./event-store.ts";

export type AggregateRepository<State, Event, Id extends string = string, StoreError = never> = {
  readonly load: (aggregateId: Id) => Effect.Effect<Aggregate<State, Event, Id>, StoreError>;
  readonly save: (
    aggregate: Aggregate<State, Event, Id>,
    metadata?: AppendMetadata,
  ) => Effect.Effect<Aggregate<State, Event, Id>, ExpectedVersionConflict | StoreError>;
};

export const makeAggregateRepository = <
  State,
  Event,
  Id extends string,
  StoreError = never,
>(options: {
  readonly store: EventStore<Event, StoreError>;
  readonly initialState: State;
  readonly applyEvent: Reducer<State, Event>;
  readonly streamName?: (aggregateId: Id) => AggregateId;
}): AggregateRepository<State, Event, Id, StoreError> => {
  const streamNameFor = options.streamName ?? ((aggregateId: Id): AggregateId => aggregateId);
  const load = (aggregateId: Id): Effect.Effect<Aggregate<State, Event, Id>, StoreError> =>
    Fn.pipe(
      options.store.fetch({ aggregateId: streamNameFor(aggregateId) }),
      Effect.map((records) =>
        reconstituteAggregate({
          aggregateId,
          initialState: options.initialState,
          applyEvent: options.applyEvent,
          events: Fn.pipe(
            records,
            Arr.map((record) => record.event),
          ),
        }),
      ),
    );

  return {
    load,
    save: (aggregate, metadata) =>
      Fn.pipe(
        options.store.append({
          aggregateId: streamNameFor(aggregate.aggregateId),
          expectedVersion: aggregate.version - aggregate.pendingEvents.length,
          events: aggregate.pendingEvents,
          metadata,
        }),
        Effect.map(() => ({
          ...aggregate,
          pendingEvents: [],
        })),
      ),
  };
};
