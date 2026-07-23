import type * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Effect from "effect/Effect";
import { runDecision } from "../../rejection.ts";
import { type CounterCommandMetadata, counterMetadata } from "./commandMetadata.ts";
import { makeCounterRepository } from "../repository.ts";

export const makeCounterHandler =
  <Command extends CounterCommandMetadata, CommandError, StoreError>(
    store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
    decide: (
      command: Command,
    ) => (aggregate: Domain.CounterAggregate) => Domain.CounterDecision<CommandError>,
  ) =>
  (
    command: Command,
  ): Effect.Effect<
    Domain.CounterAggregate,
    CommandError | EventStore.ExpectedVersionConflict | StoreError
  > =>
    Effect.gen(function* () {
      const repository = makeCounterRepository(store);
      const aggregate = yield* repository.load(command.counterId);
      const decided = yield* runDecision(decide(command)(aggregate));

      return yield* repository.save(decided, counterMetadata(command));
    });
