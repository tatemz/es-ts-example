import { expect, test } from "bun:test";
import { requireAcceptedDecision, requireRejectedDecision } from "../../src/Decision.ts";
import { propertyTestParameters, readPositiveInteger } from "../../src/PropertyTest.ts";
import * as Result from "effect/Result";
import * as FastCheck from "effect/testing/FastCheck";

type Rejection = {
  readonly _tag: "Rejected";
  readonly value: number;
};

const smallestPositiveInteger = 1;
const largestGeneratedInteger = 1_000_000;
const largestNonPositiveInteger = 0;
const largestRejectionValue = 1_000;

test("property: positive integer strings round-trip through readPositiveInteger", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.integer({ min: smallestPositiveInteger, max: largestGeneratedInteger }),
      (value) => {
        expect(readPositiveInteger("RUNS", 10, { RUNS: String(value) })).toBe(value);
      },
    ),
    propertyTestParameters,
  );
});

test("property: non-positive integer strings are rejected", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.integer({ min: -largestGeneratedInteger, max: largestNonPositiveInteger }),
      (value) => {
        expect(() => readPositiveInteger("RUNS", 10, { RUNS: String(value) })).toThrow(
          "RUNS must be a positive integer.",
        );
      },
    ),
    propertyTestParameters,
  );
});

test("property: accepted decisions expose the generated success value", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string({ maxLength: 100 }), (value) => {
      expect(requireAcceptedDecision(Result.succeed(value), "decision")).toBe(value);
    }),
    propertyTestParameters,
  );
});

test("property: rejected decisions expose the generated rejection value", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.integer({ min: smallestPositiveInteger, max: largestRejectionValue }),
      (value) => {
        expect(
          requireRejectedDecision(
            Result.fail<Rejection>({
              _tag: "Rejected",
              value,
            }),
            "Rejected",
            "decision",
          ),
        ).toEqual({
          _tag: "Rejected",
          value,
        });
      },
    ),
    propertyTestParameters,
  );
});
