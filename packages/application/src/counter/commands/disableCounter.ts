import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import { CounterCommandMetadata } from "./commandMetadata.ts";
import { makeCounterHandler } from "./makeCounterHandler.ts";

export const DisableCounterCommand = Schema.TaggedStruct("DisableCounter", {
  ...CounterCommandMetadata,
});
export type DisableCounterCommand = typeof DisableCounterCommand.Type;
export type DisableCounterCommandError<StoreError = never> =
  | Domain.DisableCounterError
  | EventStore.ExpectedVersionConflict
  | StoreError;

export const makeDisableCounterHandler = <StoreError>(
  store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
) =>
  makeCounterHandler<DisableCounterCommand, Domain.DisableCounterError, StoreError>(store, () =>
    Domain.disableCounter(),
  );
