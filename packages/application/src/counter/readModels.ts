import type * as Domain from "@es-ts-example/domain";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
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

export type CounterListProjectionState = {
  readonly counters: ReadonlyArray<CounterRead>;
};

export const initialCounterListProjectionState: CounterListProjectionState = {
  counters: [],
};

const findCounter = (
  counters: ReadonlyArray<CounterRead>,
  counterId: string,
): Option.Option<CounterRead> =>
  Arr.findFirst(counters, (counter) => counter.counterId === counterId);

const upsertCounter = (
  counters: ReadonlyArray<CounterRead>,
  counter: CounterRead,
): ReadonlyArray<CounterRead> => {
  const existing = findCounter(counters, counter.counterId);
  return Option.isNone(existing)
    ? Arr.append(counters, counter)
    : Arr.map(counters, (current) => (current.counterId === counter.counterId ? counter : current));
};

type CounterListProjectionBase = {
  readonly version: number;
  readonly value: number;
  readonly status: CounterRead["status"];
};

const counterListProjectionBase = (
  existing: CounterRead | undefined,
): CounterListProjectionBase => {
  if (existing === undefined) {
    return {
      version: 1,
      value: 0,
      status: "active",
    };
  }
  return {
    version: existing.version + 1,
    value: existing.value,
    status: existing.status,
  };
};

const counterReadFromListEvent = (
  event: Domain.CounterEvent,
  base: CounterListProjectionBase,
): CounterRead =>
  Match.valueTags(event, {
    CounterCreated: (created) =>
      CounterRead.make({
        counterId: created.counterId,
        value: 0,
        status: "active",
        version: base.version,
      }),
    CounterIncremented: (incremented) =>
      CounterRead.make({
        counterId: incremented.counterId,
        value: base.value + 1,
        status: base.status,
        version: base.version,
      }),
    CounterDecremented: (decremented) =>
      CounterRead.make({
        counterId: decremented.counterId,
        value: base.value - 1,
        status: base.status,
        version: base.version,
      }),
    CounterDisabled: (disabled) =>
      CounterRead.make({
        counterId: disabled.counterId,
        value: base.value,
        status: "disabled",
        version: base.version,
      }),
  });

export const applyCounterListEvent = (
  state: CounterListProjectionState,
  event: Domain.CounterEvent,
): CounterListProjectionState => {
  const existing = Fn.pipe(findCounter(state.counters, event.counterId), Option.getOrUndefined);
  return {
    counters: upsertCounter(
      state.counters,
      counterReadFromListEvent(event, counterListProjectionBase(existing)),
    ),
  };
};
