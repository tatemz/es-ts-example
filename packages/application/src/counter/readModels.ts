import type * as Domain from "@es-ts-example/domain";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

export const CounterRead = Schema.Struct({
  counterId: Schema.String,
  value: Schema.Number,
  status: Schema.Union([Schema.Literal("active"), Schema.Literal("disabled")]),
  version: Schema.Number,
});
export type CounterRead = typeof CounterRead.Type;

export const CounterList = Schema.Struct({
  counters: Schema.Array(CounterRead),
});
export type CounterList = typeof CounterList.Type;

export const CounterCommandReceipt = CounterRead;
export type CounterCommandReceipt = typeof CounterCommandReceipt.Type;

export const counterReadFromAggregate = (aggregate: Domain.CounterAggregate): CounterRead =>
  Match.valueTags(aggregate.state, {
    CounterNotCreated: () =>
      CounterRead.make({
        counterId: aggregate.aggregateId,
        value: 0,
        status: "active",
        version: aggregate.version,
      }),
    ActiveCounter: (state) =>
      CounterRead.make({
        counterId: state.counterId,
        value: state.value,
        status: "active",
        version: aggregate.version,
      }),
    DisabledCounter: (state) =>
      CounterRead.make({
        counterId: state.counterId,
        value: state.value,
        status: "disabled",
        version: aggregate.version,
      }),
  });
