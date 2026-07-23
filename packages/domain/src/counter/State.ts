import * as Schema from "effect/Schema";
import * as Identifiers from "./Identifiers.ts";

export const CounterValue = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(5),
);
export type CounterValue = typeof CounterValue.Type;

export const CounterNotCreated = Schema.TaggedStruct("CounterNotCreated", {});
export type CounterNotCreated = typeof CounterNotCreated.Type;

export const ActiveCounter = Schema.TaggedStruct("ActiveCounter", {
  counterId: Identifiers.CounterId,
  value: CounterValue,
});
export type ActiveCounter = typeof ActiveCounter.Type;

export const DisabledCounter = Schema.TaggedStruct("DisabledCounter", {
  counterId: Identifiers.CounterId,
  value: CounterValue,
});
export type DisabledCounter = typeof DisabledCounter.Type;

export const CounterState = Schema.Union([CounterNotCreated, ActiveCounter, DisabledCounter]);
export type CounterState = typeof CounterState.Type;

// A plain type-ascribed literal keeps module load infallible; the compiler governs the tag.
export const initialCounterState: CounterState = { _tag: "CounterNotCreated" };

export const minimumCounterValue = 0;
export const maximumCounterValue = 5;
