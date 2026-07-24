import * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import type * as Events from "./Events.ts";
import type * as Identifiers from "./Identifiers.ts";
import * as State from "./State.ts";

const toCounterValue = Num.clamp({
  maximum: State.maximumCounterValue,
  minimum: State.minimumCounterValue,
});

/**
 * `CounterValue` is checked `0..5`, so `ActiveCounter.make` rejects anything
 * outside that range. Replay must survive a log the decisions never wrote, so
 * the bound is clamped here rather than thrown.
 */
const activeCounter = (counterId: Identifiers.CounterId, value: number): State.ActiveCounter =>
  State.ActiveCounter.make({ counterId, value: toCounterValue(value) });

export const applyCounterEvent = (
  state: State.CounterState,
  event: Events.CounterEvent,
): State.CounterState =>
  Match.valueTags(state, {
    // Only creation can start a stream. Any other leading event is a log we did not write.
    CounterNotCreated: () =>
      Match.valueTags(event, {
        CounterCreated: (created) => activeCounter(created.counterId, 0),
        CounterIncremented: () => state,
        CounterDecremented: () => state,
        CounterDisabled: () => state,
      }),
    ActiveCounter: (active) =>
      Match.valueTags(event, {
        CounterCreated: () => active,
        CounterIncremented: () => activeCounter(active.counterId, active.value + 1),
        CounterDecremented: () => activeCounter(active.counterId, active.value - 1),
        CounterDisabled: () =>
          State.DisabledCounter.make({ counterId: active.counterId, value: active.value }),
      }),
    // Disabling freezes the counter. No later event reopens it.
    DisabledCounter: () => state,
  });

/** The state a log of counter events adds up to, with no aggregate wrapper. */
export const counterStateFrom = EventSourcingAggregate.replayInto(
  State.initialCounterState,
  applyCounterEvent,
);
