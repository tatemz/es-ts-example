import * as Domain from "@es-ts-example/domain";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { DomainEventStore, narrowDomainEventStore } from "../services.ts";
import type { CounterCommand } from "./commands.ts";
import { makeListCountersHandler } from "./queries/index.ts";
import { counterReadFromAggregate } from "./readModels.ts";
import { type CounterEventStore, makeCounterRepository } from "./repository.ts";
import { CounterCommandApi, CounterQueryApi } from "./rpc.ts";

const makeCounterStore = Effect.map(DomainEventStore, (store) =>
  narrowDomainEventStore(Domain.CounterEvent, store),
);

type CounterDecisionError =
  | Domain.CreateCounterError
  | Domain.IncrementCounterError
  | Domain.DecrementCounterError
  | Domain.DisableCounterError;

const decide = (
  command: CounterCommand,
  aggregate: Domain.CounterAggregate,
): Domain.CounterDecision<CounterDecisionError> =>
  Match.valueTags(command, {
    CreateCounter: (create) => Domain.createCounter({ counterId: create.counterId })(aggregate),
    IncrementCounter: () => Domain.incrementCounter()(aggregate),
    DecrementCounter: () => Domain.decrementCounter()(aggregate),
    DisableCounter: () => Domain.disableCounter()(aggregate),
  });

export const makeCounterCommandHandler = (store: CounterEventStore) => {
  const repository = makeCounterRepository(store);

  return (command: CounterCommand) =>
    Effect.gen(function* () {
      const counter = yield* repository.load(command.counterId);

      return yield* repository.commit(decide(command, counter));
    });
};

export const CounterCommandHandlers = CounterCommandApi.toLayer(
  Effect.gen(function* () {
    const handle = makeCounterCommandHandler(yield* makeCounterStore);
    const receipt = (command: CounterCommand) =>
      Effect.map(handle(command), counterReadFromAggregate);

    return CounterCommandApi.of({
      CreateCounter: receipt,
      IncrementCounter: receipt,
      DecrementCounter: receipt,
      DisableCounter: receipt,
    });
  }),
);

export const CounterQueryHandlers = CounterQueryApi.toLayer(
  Effect.gen(function* () {
    const store = yield* makeCounterStore;
    const listCounters = makeListCountersHandler(store);

    return CounterQueryApi.of({
      ListCounters: listCounters,
    });
  }),
);
