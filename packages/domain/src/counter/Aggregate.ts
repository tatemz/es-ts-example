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

const counterAggregate = EventSourcingAggregate.defineAggregate<
  State.CounterState,
  Events.CounterEvent,
  Identifiers.CounterId
>({
  initialState: State.initialCounterState,
  reducer: Reducer.applyCounterEvent,
});

/** A counter with no history yet. Nothing has happened to it. */
export const newCounter = (counterId: Identifiers.CounterId): CounterAggregate =>
  counterAggregate.empty(counterId);

export const recordCounterEvent: {
  (event: Events.CounterEvent): (aggregate: CounterAggregate) => CounterAggregate;
  (aggregate: CounterAggregate, event: Events.CounterEvent): CounterAggregate;
} = counterAggregate.recordEvent;

export const replayCounter =
  (counterId: Identifiers.CounterId) =>
  (events: ReadonlyArray<Events.CounterEvent>): CounterAggregate =>
    counterAggregate.replay(counterId)(events);
