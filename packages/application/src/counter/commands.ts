import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";

const CounterCommandMetadata = {
  counterId: Domain.CounterId,
  correlationId: Schema.optionalKey(Schema.String),
  causationId: Schema.optionalKey(Schema.String),
};

export const CreateCounterCommand = Schema.TaggedStruct("CreateCounter", {
  ...CounterCommandMetadata,
});
export type CreateCounterCommand = typeof CreateCounterCommand.Type;

export const IncrementCounterCommand = Schema.TaggedStruct("IncrementCounter", {
  ...CounterCommandMetadata,
});
export type IncrementCounterCommand = typeof IncrementCounterCommand.Type;

export const DecrementCounterCommand = Schema.TaggedStruct("DecrementCounter", {
  ...CounterCommandMetadata,
});
export type DecrementCounterCommand = typeof DecrementCounterCommand.Type;

export const DisableCounterCommand = Schema.TaggedStruct("DisableCounter", {
  ...CounterCommandMetadata,
});
export type DisableCounterCommand = typeof DisableCounterCommand.Type;

export const CounterCommand = Schema.Union([
  CreateCounterCommand,
  IncrementCounterCommand,
  DecrementCounterCommand,
  DisableCounterCommand,
]);
export type CounterCommand = typeof CounterCommand.Type;

export const counterMetadata = (command: CounterCommand): EventStore.AppendMetadata => ({
  correlationId: command.correlationId ?? `${command._tag}:${command.counterId}`,
  causationId: command.causationId,
});
