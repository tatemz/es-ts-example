import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import * as EventSourcing from "../../src/index.ts";

const CounterCreated = Schema.TaggedStruct("CounterCreated", {});
const CounterIncremented = Schema.TaggedStruct("CounterIncremented", {
  by: Schema.Number,
});
const CounterReset = Schema.TaggedStruct("CounterReset", {});
export const CounterEvent = Schema.Union([CounterCreated, CounterIncremented, CounterReset]);
export type CounterEvent = typeof CounterEvent.Type;

export type CounterError = {
  readonly _tag: "CounterClosed";
};

export type CounterStatus = "open" | "closed";

export type CounterDecision = EventSourcing.Decision<ReadonlyArray<CounterEvent>, CounterError>;

export const created = (): CounterEvent => ({ _tag: "CounterCreated" });

export const incremented = (by: number): CounterEvent => ({
  _tag: "CounterIncremented",
  by,
});

export const reset = (): CounterEvent => ({ _tag: "CounterReset" });

export const counterClosed = (): CounterError => ({ _tag: "CounterClosed" });

export const applyCounterEvent = (state: number, event: CounterEvent): number =>
  Match.value(event).pipe(
    Match.tag("CounterCreated", () => 0),
    Match.tag("CounterIncremented", (event) => state + event.by),
    Match.tag("CounterReset", () => 0),
    Match.exhaustive,
  );

export const makeCounterRepository = (store: EventSourcing.EventStore<CounterEvent>) =>
  EventSourcing.makeAggregateRepository({
    store,
    initialState: 0,
    reducer: applyCounterEvent,
  });

export const recordNewCounterEvent =
  (event: CounterEvent) =>
  <Id extends string>(
    aggregate: EventSourcing.Aggregate<number, CounterEvent, Id>,
  ): EventSourcing.Aggregate<number, CounterEvent, Id> =>
    EventSourcing.recordEvent({ reducer: applyCounterEvent, event })(aggregate);

export const decideIncrement = (status: CounterStatus, by: number): CounterDecision =>
  status === "open"
    ? EventSourcing.accept([incremented(by)])
    : EventSourcing.reject(counterClosed());
