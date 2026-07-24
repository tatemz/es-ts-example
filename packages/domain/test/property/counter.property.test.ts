import { expect, test } from "bun:test";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import * as FastCheck from "effect/testing/FastCheck";
import {
  ActiveCounter,
  CounterCreated,
  CounterDecremented,
  CounterDisabled,
  type CounterEvent,
  CounterId,
  CounterIncremented,
  CounterState,
  applyCounterEvent,
  counterStateFrom,
  initialCounterState,
  maximumCounterValue,
  minimumCounterValue,
} from "../../src/index.ts";

const counterId = CounterId.make("counter-property");

/**
 * Any event in any order, including orders the decisions would never write.
 * Replay is only correct if it holds for logs we did not author.
 */
const anyCounterLog = (): FastCheck.Arbitrary<ReadonlyArray<CounterEvent>> =>
  FastCheck.array(
    FastCheck.constantFrom<CounterEvent>(
      CounterCreated.make({ counterId }),
      CounterIncremented.make({ counterId }),
      CounterDecremented.make({ counterId }),
      CounterDisabled.make({ counterId }),
    ),
    { minLength: 1, maxLength: 24 },
  );

test("property: counter increment events raise active counter values inside the domain bounds", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.integer({ min: minimumCounterValue, max: maximumCounterValue - 1 }),
      (value) => {
        const next = applyCounterEvent(
          ActiveCounter.make({ counterId, value }),
          CounterIncremented.make({ counterId }),
        );

        expect(next).toEqual(ActiveCounter.make({ counterId, value: value + 1 }));
      },
    ),
    propertyTestParameters,
  );
});

test("property: counter decrement events lower active counter values inside the domain bounds", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.integer({ min: minimumCounterValue + 1, max: maximumCounterValue }),
      (value) => {
        const next = applyCounterEvent(
          ActiveCounter.make({ counterId, value }),
          CounterDecremented.make({ counterId }),
        );

        expect(next).toEqual(ActiveCounter.make({ counterId, value: value - 1 }));
      },
    ),
    propertyTestParameters,
  );
});

test("property: disabling freezes a counter for the rest of the log", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      const everDisabled = Arr.some(
        Arr.scan(events, initialCounterState, applyCounterEvent),
        (state) => state._tag === "DisabledCounter",
      );

      // Ends disabled if and only if it ever became disabled: nothing reopens it.
      expect(counterStateFrom(events)._tag === "DisabledCounter").toBe(everDisabled);
    }),
    propertyTestParameters,
  );
});

test("property: replay leaves a counter uncreated until a creation fact arrives", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      const created = Arr.some(events, (event) => event._tag === "CounterCreated");

      expect(counterStateFrom(events)._tag === "CounterNotCreated").toBe(!created);
    }),
    propertyTestParameters,
  );
});

test("property: replay always produces a valid state and never throws", () => {
  FastCheck.assert(
    FastCheck.property(anyCounterLog(), (events) => {
      expect(Schema.is(CounterState)(counterStateFrom(events))).toBe(true);
    }),
    propertyTestParameters,
  );
});
