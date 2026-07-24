import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as FastCheck from "effect/testing/FastCheck";
import { counterReadFromAggregate } from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-property");

const counterEvent = (): Domain.CounterEvent => Domain.CounterCreated.make({ counterId });

test("property: counter reads use the reconstituted aggregate version", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.array(FastCheck.boolean(), { minLength: 1 }), (items) => {
      const events = Fn.pipe(items, Arr.map(counterEvent));
      const aggregate = Domain.reconstituteCounter(counterId)(events);
      const read = counterReadFromAggregate(aggregate);

      expect(read.version).toBe(Arr.length(events));
    }),
    propertyTestParameters,
  );
});
