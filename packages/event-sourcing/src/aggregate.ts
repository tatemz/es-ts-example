import * as Arr from "effect/Array";
import * as Fn from "effect/Function";

export type AggregateId = string;
export type AggregateVersion = number;

export type Reducer<State, Event> = (state: State, event: Event) => State;

export type Aggregate<State, Event, Id extends string = string> = {
  readonly aggregateId: Id;
  readonly state: State;
  readonly version: AggregateVersion;
  readonly pendingEvents: ReadonlyArray<Event>;
};

export const initialVersion: AggregateVersion = 0;

/** Replays a whole log into state, ignoring aggregate identity and version. */
export const replayInto =
  <State, Event>(
    initialState: State,
    reducer: Reducer<State, Event>,
  ): ((events: ReadonlyArray<Event>) => State) =>
  (events) =>
    Fn.pipe(events, Arr.reduce(initialState, reducer));

export const makeAggregate = <State, Event, Id extends string>(
  aggregateId: Id,
  state: State,
): Aggregate<State, Event, Id> => ({
  aggregateId,
  state,
  version: initialVersion,
  pendingEvents: [],
});

/**
 * Records a brand-new fact. The event is queued in `pendingEvents` for the
 * store to append.
 */
export const recordEvent =
  <State, Event>(options: { readonly reducer: Reducer<State, Event>; readonly event: Event }) =>
  <Id extends string>(aggregate: Aggregate<State, Event, Id>): Aggregate<State, Event, Id> => ({
    ...aggregate,
    state: options.reducer(aggregate.state, options.event),
    version: aggregate.version + 1,
    pendingEvents: [...aggregate.pendingEvents, options.event],
  });

/**
 * Replays a fact that is already in the store. Nothing is queued, because there
 * is nothing left to write.
 */
export const replayEvent =
  <State, Event>(options: { readonly reducer: Reducer<State, Event>; readonly event: Event }) =>
  <Id extends string>(aggregate: Aggregate<State, Event, Id>): Aggregate<State, Event, Id> => ({
    ...aggregate,
    state: options.reducer(aggregate.state, options.event),
    version: aggregate.version + 1,
  });

export const replayAggregate = <State, Event, Id extends string>(options: {
  readonly aggregateId: Id;
  readonly initialState: State;
  readonly reducer: Reducer<State, Event>;
  readonly events: ReadonlyArray<Event>;
}): Aggregate<State, Event, Id> =>
  Fn.pipe(
    options.events,
    Arr.reduce(
      makeAggregate<State, Event, Id>(options.aggregateId, options.initialState),
      (aggregate, event) => replayEvent({ reducer: options.reducer, event })(aggregate),
    ),
  );

export type AggregateDefinition<State, Event, Id extends string> = {
  readonly empty: (aggregateId: Id) => Aggregate<State, Event, Id>;
  readonly recordEvent: {
    (event: Event): (aggregate: Aggregate<State, Event, Id>) => Aggregate<State, Event, Id>;
    (aggregate: Aggregate<State, Event, Id>, event: Event): Aggregate<State, Event, Id>;
  };
  readonly replay: (
    aggregateId: Id,
  ) => (events: ReadonlyArray<Event>) => Aggregate<State, Event, Id>;
};

/** Declares how one kind of aggregate starts, records facts, and replays. */
export const defineAggregate = <State, Event, Id extends string>(options: {
  readonly initialState: State;
  readonly reducer: Reducer<State, Event>;
}): AggregateDefinition<State, Event, Id> => ({
  empty: (aggregateId) => makeAggregate<State, Event, Id>(aggregateId, options.initialState),
  recordEvent: Fn.dual(
    2,
    (aggregate: Aggregate<State, Event, Id>, event: Event): Aggregate<State, Event, Id> =>
      recordEvent({ reducer: options.reducer, event })(aggregate),
  ),
  replay: (aggregateId) => (events) =>
    replayAggregate({
      aggregateId,
      initialState: options.initialState,
      reducer: options.reducer,
      events,
    }),
});
