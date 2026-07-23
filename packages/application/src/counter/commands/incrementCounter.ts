import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import { CounterCommandMetadata } from "./commandMetadata.ts";
import { makeCounterHandler } from "./makeCounterHandler.ts";

export const IncrementCounterCommand = Schema.TaggedStruct("IncrementCounter", {
  ...CounterCommandMetadata,
});
export type IncrementCounterCommand = typeof IncrementCounterCommand.Type;
export type IncrementCounterCommandError<StoreError = never> =
  | Domain.IncrementCounterError
  | EventStore.ExpectedVersionConflict
  | StoreError;

export const makeIncrementCounterHandler = <StoreError>(
  store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
) =>
  makeCounterHandler<IncrementCounterCommand, Domain.IncrementCounterError, StoreError>(store, () =>
    Domain.incrementCounter(),
  );
