import * as Domain from "@es-ts-example/domain";
import * as Schema from "effect/Schema";

const CounterCommandFields = {
  counterId: Domain.CounterId,
};

export const CreateCounterCommand = Schema.TaggedStruct("CreateCounter", {
  ...CounterCommandFields,
});
export type CreateCounterCommand = typeof CreateCounterCommand.Type;

export const IncrementCounterCommand = Schema.TaggedStruct("IncrementCounter", {
  ...CounterCommandFields,
});
export type IncrementCounterCommand = typeof IncrementCounterCommand.Type;

export const DecrementCounterCommand = Schema.TaggedStruct("DecrementCounter", {
  ...CounterCommandFields,
});
export type DecrementCounterCommand = typeof DecrementCounterCommand.Type;

export const DisableCounterCommand = Schema.TaggedStruct("DisableCounter", {
  ...CounterCommandFields,
});
export type DisableCounterCommand = typeof DisableCounterCommand.Type;

export const CounterCommand = Schema.Union([
  CreateCounterCommand,
  IncrementCounterCommand,
  DecrementCounterCommand,
  DisableCounterCommand,
]);
export type CounterCommand = typeof CounterCommand.Type;
