import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as FastCheck from "effect/testing/FastCheck";
import { applyCounterListEvent } from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-property");

const counterEvent = (increment: boolean): Domain.CounterEvent =>
  increment
    ? Domain.CounterIncremented.make({ counterId })
    : Domain.CounterDecremented.make({ counterId });

test("property: counter list projection version tracks same-counter event count", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.array(FastCheck.boolean(), { minLength: 1 }), (increments) => {
      const events = Fn.pipe(increments, Arr.map(counterEvent));
      const projection = Fn.pipe(events, Arr.reduce({ counters: [] }, applyCounterListEvent));
      const projected = Fn.pipe(projection.counters, Arr.get(0), Option.getOrThrow);

      expect(projected.version).toBe(Arr.length(events));
    }),
    propertyTestParameters,
  );
});
