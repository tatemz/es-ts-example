import * as Schema from "effect/Schema";
import * as Identifiers from "./Identifiers.ts";

export const CounterAlreadyExists = Schema.TaggedStruct("CounterAlreadyExists", {
  counterId: Identifiers.CounterId,
});
export type CounterAlreadyExists = typeof CounterAlreadyExists.Type;

export const CounterDoesNotExist = Schema.TaggedStruct("CounterDoesNotExist", {
  counterId: Identifiers.CounterId,
});
export type CounterDoesNotExist = typeof CounterDoesNotExist.Type;

export const CounterIsDisabled = Schema.TaggedStruct("CounterIsDisabled", {
  counterId: Identifiers.CounterId,
});
export type CounterIsDisabled = typeof CounterIsDisabled.Type;

export const CounterMinimumReached = Schema.TaggedStruct("CounterMinimumReached", {
  counterId: Identifiers.CounterId,
});
export type CounterMinimumReached = typeof CounterMinimumReached.Type;

export const CounterMaximumReached = Schema.TaggedStruct("CounterMaximumReached", {
  counterId: Identifiers.CounterId,
});
export type CounterMaximumReached = typeof CounterMaximumReached.Type;

export type CreateCounterError = CounterAlreadyExists;
export type IncrementCounterError = CounterDoesNotExist | CounterIsDisabled | CounterMaximumReached;
export type DecrementCounterError = CounterDoesNotExist | CounterIsDisabled | CounterMinimumReached;
export type DisableCounterError = CounterDoesNotExist | CounterIsDisabled;

export const counterAlreadyExists = (counterId: Identifiers.CounterId): CounterAlreadyExists =>
  CounterAlreadyExists.make({ counterId });

export const counterDoesNotExist = (counterId: Identifiers.CounterId): CounterDoesNotExist =>
  CounterDoesNotExist.make({ counterId });

export const counterIsDisabled = (counterId: Identifiers.CounterId): CounterIsDisabled =>
  CounterIsDisabled.make({ counterId });

export const counterMinimumReached = (counterId: Identifiers.CounterId): CounterMinimumReached =>
  CounterMinimumReached.make({ counterId });

export const counterMaximumReached = (counterId: Identifiers.CounterId): CounterMaximumReached =>
  CounterMaximumReached.make({ counterId });
