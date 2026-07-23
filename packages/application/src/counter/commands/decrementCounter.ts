import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import { CounterCommandMetadata } from "./commandMetadata.ts";
import { makeCounterHandler } from "./makeCounterHandler.ts";

export const DecrementCounterCommand = Schema.TaggedStruct("DecrementCounter", {
  ...CounterCommandMetadata,
});
export type DecrementCounterCommand = typeof DecrementCounterCommand.Type;
export type DecrementCounterCommandError<StoreError = never> =
  | Domain.DecrementCounterError
  | EventStore.ExpectedVersionConflict
  | StoreError;

export const makeDecrementCounterHandler = <StoreError>(
  store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
) =>
  makeCounterHandler<DecrementCounterCommand, Domain.DecrementCounterError, StoreError>(store, () =>
    Domain.decrementCounter(),
  );
