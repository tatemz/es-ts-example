import * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import type * as Events from "./Events.ts";
import type * as Identifiers from "./Identifiers.ts";
import * as Reducer from "./Reducer.ts";
import * as State from "./State.ts";

export type CounterAggregate = EventSourcingAggregate.Aggregate<
  State.CounterState,
  Events.CounterEvent,
  Identifiers.CounterId
>;

const counterAggregateFactory = EventSourcingAggregate.makeAggregateFactory<
  State.CounterState,
  Events.CounterEvent,
  Identifiers.CounterId
>({
  initialState: State.initialCounterState,
  applyEvent: Reducer.applyCounterEvent,
});

export const emptyCounter = (counterId: Identifiers.CounterId): CounterAggregate =>
  counterAggregateFactory.empty(counterId);

export const recordCounterEvent: {
  (event: Events.CounterEvent): (aggregate: CounterAggregate) => CounterAggregate;
  (aggregate: CounterAggregate, event: Events.CounterEvent): CounterAggregate;
} = counterAggregateFactory.recordEvent;

export const reconstituteCounter =
  (counterId: Identifiers.CounterId) =>
  (events: ReadonlyArray<Events.CounterEvent>): CounterAggregate =>
    counterAggregateFactory.reconstitute(counterId)(events);
