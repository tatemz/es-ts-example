import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";

export const CounterCommandMetadata = {
  counterId: Domain.CounterId,
  correlationId: Schema.optionalKey(Schema.String),
  causationId: Schema.optionalKey(Schema.String),
};

export type CounterCommandMetadata = {
  readonly _tag: string;
  readonly counterId: Domain.CounterId;
  readonly correlationId?: EventStore.CorrelationId;
  readonly causationId?: EventStore.CausationId;
};

export const counterMetadata = (input: CounterCommandMetadata): EventStore.AppendMetadata => ({
  correlationId: input.correlationId ?? `${input._tag}:${input.counterId}`,
  causationId: input.causationId,
});
