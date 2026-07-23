import * as Schema from "effect/Schema";
import * as Identifiers from "./Identifiers.ts";

export const CounterCreated = Schema.TaggedStruct("CounterCreated", {
  counterId: Identifiers.CounterId,
});
export type CounterCreated = typeof CounterCreated.Type;

export const CounterIncremented = Schema.TaggedStruct("CounterIncremented", {
  counterId: Identifiers.CounterId,
});
export type CounterIncremented = typeof CounterIncremented.Type;

export const CounterDecremented = Schema.TaggedStruct("CounterDecremented", {
  counterId: Identifiers.CounterId,
});
export type CounterDecremented = typeof CounterDecremented.Type;

export const CounterDisabled = Schema.TaggedStruct("CounterDisabled", {
  counterId: Identifiers.CounterId,
});
export type CounterDisabled = typeof CounterDisabled.Type;

export const CounterEvent = Schema.Union([
  CounterCreated,
  CounterIncremented,
  CounterDecremented,
  CounterDisabled,
]);
export type CounterEvent = typeof CounterEvent.Type;
