import * as Domain from "@es-ts-example/domain";
import * as Effect from "effect/Effect";
import { DomainEventStore, narrowDomainEventStore } from "../services.ts";
import {
  makeCreateCounterHandler,
  makeDecrementCounterHandler,
  makeDisableCounterHandler,
  makeIncrementCounterHandler,
} from "./commands/index.ts";
import { makeListCountersHandler } from "./queries/index.ts";
import { counterReadFromAggregate } from "./readModels.ts";
import { CounterCommandApi, CounterQueryApi } from "./rpc.ts";

const makeCounterStore = Effect.map(DomainEventStore, (store) =>
  narrowDomainEventStore(Domain.CounterEvent, store),
);

export const CounterCommandHandlers = CounterCommandApi.toLayer(
  Effect.gen(function* () {
    const store = yield* makeCounterStore;
    const createCounter = makeCreateCounterHandler(store);
    const incrementCounter = makeIncrementCounterHandler(store);
    const decrementCounter = makeDecrementCounterHandler(store);
    const disableCounter = makeDisableCounterHandler(store);

    return CounterCommandApi.of({
      CreateCounter: (command) => Effect.map(createCounter(command), counterReadFromAggregate),
      IncrementCounter: (command) =>
        Effect.map(incrementCounter(command), counterReadFromAggregate),
      DecrementCounter: (command) =>
        Effect.map(decrementCounter(command), counterReadFromAggregate),
      DisableCounter: (command) => Effect.map(disableCounter(command), counterReadFromAggregate),
    });
  }),
);

export const CounterQueryHandlers = CounterQueryApi.toLayer(
  Effect.gen(function* () {
    const store = yield* makeCounterStore;
    const listCounters = makeListCountersHandler(store);

    return CounterQueryApi.of({
      ListCounters: () =>
        Effect.map(listCounters(), (state) => ({
          counters: state.counters,
        })),
    });
  }),
);
