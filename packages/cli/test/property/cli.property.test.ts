import { expect, test } from "bun:test";
import * as Application from "@es-ts-example/application";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as FastCheck from "effect/testing/FastCheck";
import { parseArguments, renderList } from "../../src/index.ts";

const verbPairs = [
  ["create", "Create"],
  ["increment", "Increment"],
  ["decrement", "Decrement"],
  ["disable", "Disable"],
] as const;

const statusArb: FastCheck.Arbitrary<"active" | "disabled"> = FastCheck.constantFrom(
  "active",
  "disabled",
);

const counterArb: FastCheck.Arbitrary<Application.CounterRead> = FastCheck.record({
  counterId: FastCheck.string({ minLength: 1 }),
  value: FastCheck.integer(),
  status: statusArb,
  version: FastCheck.integer({ min: 0 }),
});

test("property: a known verb plus a non-empty id parses into its command", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.constantFrom(...verbPairs),
      FastCheck.string({ minLength: 1 }),
      ([input, verb], id) => {
        expect(parseArguments([input, id])).toEqual({
          _tag: "Command",
          verb,
          counterId: Application.CounterId.make(id),
        });
      },
    ),
    propertyTestParameters,
  );
});

test("property: renderList adds exactly one header line to a populated listing", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.array(counterArb), (counters) => {
      const lines = renderList({ counters });
      const expected = Arr.isReadonlyArrayEmpty(counters) ? 1 : Arr.length(counters) + 1;
      expect(Arr.length(lines)).toBe(expected);
    }),
    propertyTestParameters,
  );
});
