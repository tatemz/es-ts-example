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

export const fold =
  <State, Event>(
    initialState: State,
    applyEvent: Reducer<State, Event>,
  ): ((events: ReadonlyArray<Event>) => State) =>
  (events) =>
    Fn.pipe(events, Arr.reduce(initialState, applyEvent));

export const makeAggregate = <State, Event, Id extends string>(
  aggregateId: Id,
  state: State,
): Aggregate<State, Event, Id> => ({
  aggregateId,
  state,
  version: initialVersion,
  pendingEvents: [],
});

export const applyEvent =
  <State, Event>(options: {
    readonly applyEvent: Reducer<State, Event>;
    readonly event: Event;
    readonly isNew: boolean;
  }) =>
  <Id extends string>(aggregate: Aggregate<State, Event, Id>): Aggregate<State, Event, Id> => ({
    ...aggregate,
    state: options.applyEvent(aggregate.state, options.event),
    version: aggregate.version + 1,
    pendingEvents: options.isNew
      ? [...aggregate.pendingEvents, options.event]
      : aggregate.pendingEvents,
  });

export const reconstituteAggregate = <State, Event, Id extends string>(options: {
  readonly aggregateId: Id;
  readonly initialState: State;
  readonly applyEvent: Reducer<State, Event>;
  readonly events: ReadonlyArray<Event>;
}): Aggregate<State, Event, Id> =>
  Fn.pipe(
    options.events,
    Arr.reduce(
      makeAggregate<State, Event, Id>(options.aggregateId, options.initialState),
      (aggregate, event) =>
        applyEvent({
          applyEvent: options.applyEvent,
          event,
          isNew: false,
        })(aggregate),
    ),
  );

export type AggregateFactory<State, Event, Id extends string> = {
  readonly empty: (aggregateId: Id) => Aggregate<State, Event, Id>;
  readonly recordEvent: {
    (event: Event): (aggregate: Aggregate<State, Event, Id>) => Aggregate<State, Event, Id>;
    (aggregate: Aggregate<State, Event, Id>, event: Event): Aggregate<State, Event, Id>;
  };
  readonly reconstitute: (
    aggregateId: Id,
  ) => (events: ReadonlyArray<Event>) => Aggregate<State, Event, Id>;
};

export const makeAggregateFactory = <State, Event, Id extends string>(options: {
  readonly initialState: State;
  readonly applyEvent: Reducer<State, Event>;
}): AggregateFactory<State, Event, Id> => ({
  empty: (aggregateId) => makeAggregate<State, Event, Id>(aggregateId, options.initialState),
  recordEvent: Fn.dual(
    2,
    (aggregate: Aggregate<State, Event, Id>, event: Event): Aggregate<State, Event, Id> =>
      applyEvent({
        applyEvent: options.applyEvent,
        event,
        isNew: true,
      })(aggregate),
  ),
  reconstitute: (aggregateId) => (events) =>
    reconstituteAggregate({
      aggregateId,
      initialState: options.initialState,
      applyEvent: options.applyEvent,
      events,
    }),
});
