import { expect, test } from "bun:test";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as FastCheck from "effect/testing/FastCheck";
import {
  ActiveCounter,
  CounterDecremented,
  CounterId,
  CounterIncremented,
  applyCounterEvent,
  maximumCounterValue,
  minimumCounterValue,
} from "../../src/index.ts";

const counterId = CounterId.make("counter-property");

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
