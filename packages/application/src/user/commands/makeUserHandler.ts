import type * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Effect from "effect/Effect";
import { runDecision } from "../../rejection.ts";
import { makeUserRepository } from "../repository.ts";
import { type UserCommandMetadata, userMetadata } from "./commandMetadata.ts";

export const makeUserHandler =
  <Command extends UserCommandMetadata, StoreError>(
    store: EventStore.EventStore<Domain.UserEvent, StoreError>,
    decide: (command: Command) => (aggregate: Domain.UserAggregate) => Domain.UserDecision<never>,
  ) =>
  (
    command: Command,
  ): Effect.Effect<Domain.UserAggregate, EventStore.ExpectedVersionConflict | StoreError> =>
    Effect.gen(function* () {
      const repository = makeUserRepository(store);
      const aggregate = yield* repository.load(command.userId);
      const decided = yield* runDecision(decide(command)(aggregate));

      return yield* repository.save(decided, userMetadata(command));
    });
