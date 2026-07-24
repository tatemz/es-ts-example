import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as FastCheck from "effect/testing/FastCheck";
import { counterSummaryOf } from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-property");

/**
 * Any event in any order, including orders the decisions would never write.
 * A read model must survive logs it did not author.
 */
const anyCounterLog = (): FastCheck.Arbitrary<ReadonlyArray<Domain.CounterEvent>> =>
  FastCheck.array(
    FastCheck.constantFrom<Domain.CounterEvent>(
      Domain.CounterCreated.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterDecremented.make({ counterId }),
      Domain.CounterDisabled.make({ counterId }),
    ),
    { minLength: 1, maxLength: 24 },
  );

test("property: a summary exists exactly when the log created the counter", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      const created = Arr.some(events, (event) => event._tag === "CounterCreated");

      expect(Option.isSome(counterSummaryOf(Domain.replayCounter(counterId)(events)))).toBe(
        created,
      );
    }),
    propertyTestParameters,
  );
});

test("property: a summary reports the replayed aggregate version", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      const summary = counterSummaryOf(Domain.replayCounter(counterId)(events));

      expect(Option.map(summary, (value) => value.version)).toEqual(
        Option.map(summary, () => Arr.length(events)),
      );
    }),
    propertyTestParameters,
  );
});

test("property: a summary is disabled exactly when the log disabled the counter", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      const summary = counterSummaryOf(Domain.replayCounter(counterId)(events));
      const frozen = Domain.counterStateFrom(events)._tag === "DisabledCounter";

      expect(Option.map(summary, (value) => value._tag === "DisabledCounterSummary")).toEqual(
        Option.map(summary, () => frozen),
      );
    }),
    propertyTestParameters,
  );
});
