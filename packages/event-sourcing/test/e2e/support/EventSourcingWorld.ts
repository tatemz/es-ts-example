import * as Effect from "effect/Effect";
import * as EventSourcing from "../../../src/index.ts";
import {
  type CounterDecision,
  type CounterEvent,
  type CounterStatus,
  applyCounterEvent,
} from "../../support/Counter.ts";

export const reject = (message: string): Effect.Effect<never, string> => Effect.fail(message);

export const requiredScenarioValue = <A>(
  value: A | undefined,
  name: string,
): Effect.Effect<A, string> =>
  value === undefined ? reject(`${name} was not set by the scenario.`) : Effect.succeed(value);

export const runSync = <A, E>(effect: Effect.Effect<A, E>): A => Effect.runSync(effect);

export const makeRepository = (store: EventSourcing.EventStore<CounterEvent>) =>
  EventSourcing.makeAggregateRepository({
    store,
    initialState: 0,
    reducer: applyCounterEvent,
  });

export type EventSourcingScenarioState = {
  readonly counterHistory: ReadonlyArray<CounterEvent>;
  readonly counterAggregate: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly store: EventSourcing.EventStore<CounterEvent> | undefined;
  readonly repository: EventSourcing.AggregateRepository<number, CounterEvent> | undefined;
  readonly firstRepository: EventSourcing.AggregateRepository<number, CounterEvent> | undefined;
  readonly secondRepository: EventSourcing.AggregateRepository<number, CounterEvent> | undefined;
  readonly firstCopy: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly secondCopy: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly loadedCounter: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly savedCounter: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly firstLoadedCounter: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly secondLoadedCounter: EventSourcing.Aggregate<number, CounterEvent> | undefined;
  readonly fetchedStream: string | undefined;
  readonly fetchedRecords: ReadonlyArray<EventSourcing.StoredEvent<CounterEvent>> | undefined;
  readonly appendConflict: EventSourcing.ExpectedVersionConflict | undefined;
  readonly saveConflict: EventSourcing.ExpectedVersionConflict | undefined;
  readonly counterStatus: CounterStatus | undefined;
  readonly decision: CounterDecision | undefined;
};

export const initialEventSourcingScenarioState: EventSourcingScenarioState = {
  counterHistory: [],
  counterAggregate: undefined,
  store: undefined,
  repository: undefined,
  firstRepository: undefined,
  secondRepository: undefined,
  firstCopy: undefined,
  secondCopy: undefined,
  loadedCounter: undefined,
  savedCounter: undefined,
  firstLoadedCounter: undefined,
  secondLoadedCounter: undefined,
  fetchedStream: undefined,
  fetchedRecords: undefined,
  appendConflict: undefined,
  saveConflict: undefined,
  counterStatus: undefined,
  decision: undefined,
};
