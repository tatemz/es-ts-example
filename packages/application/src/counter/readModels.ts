import * as Domain from "@es-ts-example/domain";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/**
 * A summary describes a counter that exists. `CounterNotCreated` has no summary
 * on purpose: replay leaves a stream uncreated until a creation fact arrives,
 * and a read model must not invent one.
 */
export const ActiveCounterSummary = Schema.TaggedStruct("ActiveCounterSummary", {
  counterId: Domain.CounterId,
  value: Schema.Number,
  version: Schema.Number,
});
export type ActiveCounterSummary = typeof ActiveCounterSummary.Type;

export const DisabledCounterSummary = Schema.TaggedStruct("DisabledCounterSummary", {
  counterId: Domain.CounterId,
  value: Schema.Number,
  version: Schema.Number,
});
export type DisabledCounterSummary = typeof DisabledCounterSummary.Type;

export const CounterSummary = Schema.Union([ActiveCounterSummary, DisabledCounterSummary]);
export type CounterSummary = typeof CounterSummary.Type;

export const CounterList = Schema.Struct({
  counters: Schema.Array(CounterSummary),
});
export type CounterList = typeof CounterList.Type;

/**
 * A receipt acknowledges a write; it does not describe state. Both fields exist
 * on every aggregate, so no command outcome has to be invented. Callers that
 * need the resulting state query for it, which is what the CLI and web both do.
 */
export const CounterCommandReceipt = Schema.Struct({
  counterId: Domain.CounterId,
  version: Schema.Number,
});
export type CounterCommandReceipt = typeof CounterCommandReceipt.Type;

export const counterCommandReceiptOf = (
  aggregate: Domain.CounterAggregate,
): CounterCommandReceipt =>
  CounterCommandReceipt.make({
    counterId: aggregate.aggregateId,
    version: aggregate.version,
  });

export const counterSummaryOf = (
  aggregate: Domain.CounterAggregate,
): Option.Option<CounterSummary> =>
  Match.valueTags(aggregate.state, {
    CounterNotCreated: () => Option.none<CounterSummary>(),
    ActiveCounter: (state) =>
      Option.some(
        ActiveCounterSummary.make({
          counterId: state.counterId,
          value: state.value,
          version: aggregate.version,
        }),
      ),
    DisabledCounter: (state) =>
      Option.some(
        DisabledCounterSummary.make({
          counterId: state.counterId,
          value: state.value,
          version: aggregate.version,
        }),
      ),
  });
