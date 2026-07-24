import * as EventSourcingDecision from "@es-ts-example/event-sourcing/decision";
import * as Schema from "effect/Schema";
import * as Aggregate from "./Aggregate.ts";
import * as Events from "./Events.ts";
import type * as Identifiers from "./Identifiers.ts";
import * as Rejections from "./Rejections.ts";
import * as State from "./State.ts";

export type CounterDecision<Error> = EventSourcingDecision.Decision<
  Aggregate.CounterAggregate,
  Error
>;
export type CreateCounterError = Rejections.CreateCounterError;
export type IncrementCounterError = Rejections.IncrementCounterError;
export type DecrementCounterError = Rejections.DecrementCounterError;
export type DisableCounterError = Rejections.DisableCounterError;

const rejectMissingCounter = (
  aggregate: Aggregate.CounterAggregate,
): EventSourcingDecision.Decision<never, Rejections.CounterDoesNotExist> =>
  EventSourcingDecision.reject(Rejections.counterDoesNotExist(aggregate.aggregateId));

const rejectDisabledCounter = (
  aggregate: Aggregate.CounterAggregate,
): EventSourcingDecision.Decision<never, Rejections.CounterIsDisabled> =>
  EventSourcingDecision.reject(Rejections.counterIsDisabled(aggregate.aggregateId));

export const createCounter =
  (input: { readonly counterId: Identifiers.CounterId }) =>
  (aggregate: Aggregate.CounterAggregate): CounterDecision<CreateCounterError> => {
    if (!Schema.is(State.CounterNotCreated)(aggregate.state)) {
      return EventSourcingDecision.reject(Rejections.counterAlreadyExists(aggregate.aggregateId));
    }

    return EventSourcingDecision.accept(
      Aggregate.recordCounterEvent(Events.CounterCreated.make({ counterId: input.counterId }))(
        aggregate,
      ),
    );
  };

export const incrementCounter =
  () =>
  (aggregate: Aggregate.CounterAggregate): CounterDecision<IncrementCounterError> => {
    if (Schema.is(State.CounterNotCreated)(aggregate.state)) {
      return rejectMissingCounter(aggregate);
    }

    if (Schema.is(State.DisabledCounter)(aggregate.state)) {
      return rejectDisabledCounter(aggregate);
    }

    if (aggregate.state.value >= State.maximumCounterValue) {
      return EventSourcingDecision.reject(Rejections.counterMaximumReached(aggregate.aggregateId));
    }

    return EventSourcingDecision.accept(
      Aggregate.recordCounterEvent(
        Events.CounterIncremented.make({ counterId: aggregate.aggregateId }),
      )(aggregate),
    );
  };

export const decrementCounter =
  () =>
  (aggregate: Aggregate.CounterAggregate): CounterDecision<DecrementCounterError> => {
    if (Schema.is(State.CounterNotCreated)(aggregate.state)) {
      return rejectMissingCounter(aggregate);
    }

    if (Schema.is(State.DisabledCounter)(aggregate.state)) {
      return rejectDisabledCounter(aggregate);
    }

    if (aggregate.state.value <= State.minimumCounterValue) {
      return EventSourcingDecision.reject(Rejections.counterMinimumReached(aggregate.aggregateId));
    }

    return EventSourcingDecision.accept(
      Aggregate.recordCounterEvent(
        Events.CounterDecremented.make({ counterId: aggregate.aggregateId }),
      )(aggregate),
    );
  };

export const disableCounter =
  () =>
  (aggregate: Aggregate.CounterAggregate): CounterDecision<DisableCounterError> => {
    if (Schema.is(State.CounterNotCreated)(aggregate.state)) {
      return rejectMissingCounter(aggregate);
    }

    if (Schema.is(State.DisabledCounter)(aggregate.state)) {
      return rejectDisabledCounter(aggregate);
    }

    return EventSourcingDecision.accept(
      Aggregate.recordCounterEvent(
        Events.CounterDisabled.make({ counterId: aggregate.aggregateId }),
      )(aggregate),
    );
  };
