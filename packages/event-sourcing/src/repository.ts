import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Result from "effect/Result";
import type { Aggregate, AggregateId, Reducer } from "./aggregate.ts";
import { replayAggregate } from "./aggregate.ts";
import type { Decision } from "./decision.ts";
import type { EventStore, ExpectedVersionConflict } from "./event-store.ts";

export type AggregateRepository<State, Event, Id extends string = string, StoreError = never> = {
  readonly load: (aggregateId: Id) => Effect.Effect<Aggregate<State, Event, Id>, StoreError>;
  readonly save: (
    aggregate: Aggregate<State, Event, Id>,
  ) => Effect.Effect<Aggregate<State, Event, Id>, ExpectedVersionConflict | StoreError>;
  readonly commit: <Error>(
    decision: Decision<Aggregate<State, Event, Id>, Error>,
  ) => Effect.Effect<Aggregate<State, Event, Id>, Error | ExpectedVersionConflict | StoreError>;
};

export const makeAggregateRepository = <
  State,
  Event,
  Id extends string,
  StoreError = never,
>(options: {
  readonly store: EventStore<Event, StoreError>;
  readonly initialState: State;
  readonly reducer: Reducer<State, Event>;
  readonly streamName?: (aggregateId: Id) => AggregateId;
}): AggregateRepository<State, Event, Id, StoreError> => {
  const streamNameFor = options.streamName ?? ((aggregateId: Id): AggregateId => aggregateId);
  const load = (aggregateId: Id): Effect.Effect<Aggregate<State, Event, Id>, StoreError> =>
    Fn.pipe(
      options.store.fetch({ aggregateId: streamNameFor(aggregateId) }),
      Effect.map((records) =>
        replayAggregate({
          aggregateId,
          initialState: options.initialState,
          reducer: options.reducer,
          events: Fn.pipe(
            records,
            Arr.map((record) => record.event),
          ),
        }),
      ),
    );
  const save = (
    aggregate: Aggregate<State, Event, Id>,
  ): Effect.Effect<Aggregate<State, Event, Id>, ExpectedVersionConflict | StoreError> =>
    Fn.pipe(
      options.store.append({
        aggregateId: streamNameFor(aggregate.aggregateId),
        expectedVersion: aggregate.version - aggregate.pendingEvents.length,
        events: aggregate.pendingEvents,
      }),
      Effect.map(() => ({
        ...aggregate,
        pendingEvents: [],
      })),
    );

  return {
    load,
    save,
    commit: (decision) =>
      Result.isFailure(decision) ? Effect.fail(decision.failure) : save(decision.success),
  };
};
