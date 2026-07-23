import * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import type * as Events from "./Events.ts";
import * as State from "./State.ts";

const isNotCreated = Schema.is(State.CounterNotCreated);

export const applyCounterEvent = (
  state: State.CounterState,
  event: Events.CounterEvent,
): State.CounterState =>
  Match.valueTags(event, {
    CounterCreated: (created) =>
      State.ActiveCounter.make({
        counterId: created.counterId,
        value: 0,
      }),
    CounterIncremented: (incremented) =>
      State.ActiveCounter.make({
        counterId: incremented.counterId,
        value: isNotCreated(state) ? 1 : state.value + 1,
      }),
    CounterDecremented: (decremented) =>
      State.ActiveCounter.make({
        counterId: decremented.counterId,
        value: isNotCreated(state) ? 0 : state.value - 1,
      }),
    CounterDisabled: (disabled) =>
      State.DisabledCounter.make({
        counterId: disabled.counterId,
        value: isNotCreated(state) ? 0 : state.value,
      }),
  });

export const foldCounter = EventSourcingAggregate.fold(
  State.initialCounterState,
  applyCounterEvent,
);
