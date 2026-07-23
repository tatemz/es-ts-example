import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import { CounterCommandMetadata } from "./commandMetadata.ts";
import { makeCounterHandler } from "./makeCounterHandler.ts";

export const CreateCounterCommand = Schema.TaggedStruct("CreateCounter", {
  ...CounterCommandMetadata,
});
export type CreateCounterCommand = typeof CreateCounterCommand.Type;
export type CreateCounterCommandError<StoreError = never> =
  | Domain.CreateCounterError
  | EventStore.ExpectedVersionConflict
  | StoreError;

export const makeCreateCounterHandler = <StoreError>(
  store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
) =>
  makeCounterHandler<CreateCounterCommand, Domain.CreateCounterError, StoreError>(
    store,
    (command) => Domain.createCounter({ counterId: command.counterId }),
  );
