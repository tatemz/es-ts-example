import type * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

export const runDecision = <State, Event, Id extends string, Error>(
  decision: Result.Result<EventSourcingAggregate.Aggregate<State, Event, Id>, Error>,
): Effect.Effect<EventSourcingAggregate.Aggregate<State, Event, Id>, Error> =>
  Result.isFailure(decision) ? Effect.fail(decision.failure) : Effect.succeed(decision.success);
