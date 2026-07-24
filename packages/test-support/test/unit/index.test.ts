import { expect, test } from "bun:test";
import {
  matchRejection,
  requireAcceptedDecision,
  requireRejectedDecision,
} from "../../src/Decision.ts";
import {
  greeterName,
  greeterNameMaxLength,
  greeterNameMinLength,
  propertyTestParameters,
  readPositiveInteger,
} from "../../src/PropertyTest.ts";
import { captureLogs, runTestEffect, testEffect } from "../../src/TestEffect.ts";
import * as BddAssertions from "../../src/BddAssertions.ts";
import { runEffectMain } from "../../src/run-effect-main.ts";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as FastCheck from "effect/testing/FastCheck";

type TestRejection =
  | {
      readonly _tag: "MissingName";
      readonly field: "name";
    }
  | {
      readonly _tag: "TooShort";
      readonly minimum: number;
    };

const testEffectRan = Effect.runSync(Ref.make(false));

testEffect("testEffect runs Effect tests", () => Ref.set(testEffectRan, true));

test("testEffect registered test executes the supplied effect", () => {
  expect(Effect.runSync(Ref.get(testEffectRan))).toBe(true);
});

test("runTestEffect runs the supplied effect to completion", () => {
  const ran = Effect.runSync(Ref.make(false));

  return runTestEffect(() => Ref.set(ran, true)).then(() => {
    expect(Effect.runSync(Ref.get(ran))).toBe(true);
  });
});

test("requireAcceptedDecision returns accepted values", () => {
  expect(requireAcceptedDecision(Result.succeed("accepted"), "decision")).toBe("accepted");
});

test("requireAcceptedDecision reports tagged rejections", () => {
  expect(() =>
    requireAcceptedDecision(Result.fail({ _tag: "MissingName", field: "name" }), "decision"),
  ).toThrow("Expected decision to be accepted, but it was rejected with MissingName.");
});

test("requireAcceptedDecision reports untagged string rejections", () => {
  expect(() => requireAcceptedDecision(Result.fail("bad"), "decision")).toThrow(
    "Expected decision to be accepted, but it was rejected with unknown.",
  );
});

test("requireAcceptedDecision reports null rejections", () => {
  expect(() => requireAcceptedDecision(Result.fail(null), "decision")).toThrow(
    "Expected decision to be accepted, but it was rejected with unknown.",
  );
});

test("requireRejectedDecision returns matching tagged rejections", () => {
  const rejection = requireRejectedDecision(
    Result.fail<TestRejection>({
      _tag: "TooShort",
      minimum: 3,
    }),
    "TooShort",
    "decision",
  );

  expect(rejection.minimum).toBe(3);
});

test("requireRejectedDecision reports accepted decisions", () => {
  const accepted: Result.Result<string, TestRejection> = Result.succeed("ok");

  expect(() => requireRejectedDecision(accepted, "TooShort", "decision")).toThrow(
    "Expected decision to be rejected with TooShort, but it was accepted.",
  );
});

test("requireRejectedDecision reports mismatched decisions", () => {
  expect(() =>
    requireRejectedDecision(
      Result.fail<TestRejection>({
        _tag: "MissingName",
        field: "name",
      }),
      "TooShort",
      "decision",
    ),
  ).toThrow(
    'Expected decision to be rejected with TooShort, but it was rejected with MissingName: {"_tag":"MissingName","field":"name"}.',
  );
});

test("requireRejectedDecision describes values that cannot be JSON stringified", () => {
  const circular = {
    _tag: "MissingName",
    field: "name",
  } as TestRejection & { readonly self?: unknown };
  Object.defineProperty(circular, "self", {
    enumerable: true,
    value: circular,
  });

  expect(() => requireRejectedDecision(Result.fail(circular), "TooShort", "decision")).toThrow(
    "Expected decision to be rejected with TooShort, but it was rejected with MissingName: [object Object].",
  );
});

test("matchRejection invokes the matching handler", () => {
  expect(() =>
    matchRejection(
      Result.fail<TestRejection>({
        _tag: "MissingName",
        field: "name",
      }),
      {
        MissingName: (error) => {
          throw new Error(`handled rejection field: ${error.field}`);
        },
        TooShort: () => {},
      },
      "decision",
    ),
  ).toThrow("handled rejection field: name");
});

test("matchRejection reports accepted decisions", () => {
  expect(() => matchRejection(Result.succeed("ok"), {}, "decision")).toThrow(
    "Expected decision to be rejected, but it was accepted.",
  );
});

test("matchRejection reports missing handlers", () => {
  expect(() =>
    matchRejection(
      Result.fail<TestRejection>({
        _tag: "TooShort",
        minimum: 3,
      }),
      {
        MissingName: () => {},
      },
      "decision",
    ),
  ).toThrow('No rejection handler for TooShort: {"_tag":"TooShort","minimum":3}.');
});

testEffect("captureLogs returns emitted log messages", () =>
  Effect.gen(function* () {
    const logs = yield* captureLogs(Effect.logInfo("hello"));

    expect(logs).toEqual(["hello"]);
  }),
);

test("readPositiveInteger reads fallbacks and overrides", () => {
  expect({
    fallback: readPositiveInteger("RUNS", 10),
    override: readPositiveInteger("RUNS", 10, { RUNS: "25" }),
  }).toEqual({
    fallback: 10,
    override: 25,
  });
});

test("readPositiveInteger rejects zero values", () => {
  expect(() => readPositiveInteger("RUNS", 10, { RUNS: "0" })).toThrow(
    "RUNS must be a positive integer.",
  );
});

test("readPositiveInteger rejects decimal values", () => {
  expect(() => readPositiveInteger("RUNS", 10, { RUNS: "1.5" })).toThrow(
    "RUNS must be a positive integer.",
  );
});

test("greeterName arbitrary respects the configured length bounds", () => {
  const samples = FastCheck.sample(greeterName, 100);

  expect(greeterNameMinLength).toBe(1);
  expect(greeterNameMaxLength).toBe(100);
  expect(Arr.every(samples, (sample) => sample.length >= greeterNameMinLength)).toBe(true);
  expect(Arr.every(samples, (sample) => sample.length <= greeterNameMaxLength)).toBe(true);
});

test("BDD assertions accept matching expected values", () => {
  BddAssertions.assertCounterValue(7, 7);
  BddAssertions.assertCounterIsActive(true);
  BddAssertions.assertBookmarkedArticles(["small-batches"], ["small-batches"]);
  BddAssertions.assertListedArticles(["small-batches"], ["small-batches"]);
});

test("BDD assertions reject mismatched values", () => {
  const strictEqualMessage = "Expected values to be strictly equal";
  const deepEqualMessage = "Expected values to be strictly deep-equal";

  expect(() => BddAssertions.assertCounterValue(7, 8)).toThrow(strictEqualMessage);
  expect(() => BddAssertions.assertCounterIsActive(false)).toThrow(strictEqualMessage);
  expect(() => BddAssertions.assertBookmarkedArticles([], ["small-batches"])).toThrow(
    deepEqualMessage,
  );
  expect(() => BddAssertions.assertListedArticles(["small-batches"], [])).toThrow(deepEqualMessage);
});

test("property test parameters keep strict interrupt settings", () => {
  expect(propertyTestParameters).toEqual({
    interruptAfterTimeLimit: 5_000,
    markInterruptAsFailure: true,
    numRuns: 1_000,
  });
});

testEffect("runEffectMain accepts successful main effects", () =>
  Effect.gen(function* () {
    const ran = yield* Ref.make(false);

    runEffectMain(Ref.set(ran, true));

    expect(yield* Ref.get(ran)).toBe(true);
  }),
);
