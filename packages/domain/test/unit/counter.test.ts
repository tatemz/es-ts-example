import { describe, expect, test } from "bun:test";
import {
  requireAcceptedDecision,
  requireRejectedDecision,
} from "@es-ts-example/test-support/Decision";
import * as Fn from "effect/Function";
import * as Schema from "effect/Schema";
import * as Domain from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");

const emptyCounter = (): Domain.CounterAggregate => Domain.emptyCounter(counterId);

const activeCounter = (): Domain.CounterAggregate =>
  requireAcceptedDecision(
    Domain.createCounter({ counterId })(emptyCounter()),
    "create counter decision",
  );

const incrementAggregate = (
  aggregate: Domain.CounterAggregate,
  remaining: number,
): Domain.CounterAggregate =>
  remaining <= 0
    ? aggregate
    : incrementAggregate(
        requireAcceptedDecision(Domain.incrementCounter()(aggregate), "increment counter decision"),
        remaining - 1,
      );

const incrementedCounter = (times: number): Domain.CounterAggregate =>
  Fn.pipe(activeCounter(), (aggregate) => incrementAggregate(aggregate, times));

describe("Counter", () => {
  test("creates active counters at zero", () => {
    expect(Schema.is(Domain.CounterId)("counter-1")).toBe(true);
    expect(Schema.is(Domain.CounterId)("")).toBe(false);
    expect(JSON.stringify(Domain.CounterId.ast)).toContain("CounterId");
    expect(JSON.stringify(Domain.CounterState.ast)).toContain("CounterNotCreated");
    expect(JSON.stringify(Domain.CounterState.ast)).toContain("ActiveCounter");
    expect(JSON.stringify(Domain.CounterState.ast)).toContain("DisabledCounter");
    expect(() => Schema.decodeUnknownSync(Domain.CounterState)({})).toThrow();
    expect(() => Schema.decodeUnknownSync(Domain.DisabledCounter)({})).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Domain.DisabledCounter)({ _tag: "DisabledCounter" }),
    ).toThrow();
    expect(emptyCounter()).toEqual({
      aggregateId: counterId,
      state: Domain.CounterNotCreated.make({}),
      version: 0,
      pendingEvents: [],
    });
    expect(emptyCounter().state).toHaveProperty("_tag", "CounterNotCreated");

    expect(activeCounter().state).toEqual(
      Domain.ActiveCounter.make({
        counterId,
        value: 0,
      }),
    );
  });

  test("increments and decrements within bounds", () => {
    const incremented = incrementedCounter(2);
    const decremented = requireAcceptedDecision(
      Domain.decrementCounter()(incremented),
      "decrement counter decision",
    );

    expect(decremented.state).toEqual(
      Domain.ActiveCounter.make({
        counterId,
        value: 1,
      }),
    );
  });

  test("reconstitutes counter history", () => {
    const reconstituted = Domain.reconstituteCounter(counterId)([
      Domain.CounterCreated.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterDisabled.make({ counterId }),
    ]);

    expect(reconstituted).toEqual({
      aggregateId: counterId,
      state: Domain.DisabledCounter.make({
        counterId,
        value: 1,
      }),
      version: 3,
      pendingEvents: [],
    });
  });

  test("rejects duplicate, missing, and bounded commands", () => {
    expect(
      requireRejectedDecision(
        Domain.createCounter({ counterId })(activeCounter()),
        "CounterAlreadyExists",
        "duplicate counter",
      ),
    ).toEqual(Domain.counterAlreadyExists(counterId));
    expect(
      requireRejectedDecision(
        Domain.incrementCounter()(emptyCounter()),
        "CounterDoesNotExist",
        "missing counter increment",
      ),
    ).toEqual(Domain.counterDoesNotExist(counterId));
    expect(
      requireRejectedDecision(
        Domain.decrementCounter()(emptyCounter()),
        "CounterDoesNotExist",
        "missing counter decrement",
      ),
    ).toEqual(Domain.counterDoesNotExist(counterId));
    expect(
      requireRejectedDecision(
        Domain.disableCounter()(emptyCounter()),
        "CounterDoesNotExist",
        "missing counter disable",
      ),
    ).toEqual(Domain.counterDoesNotExist(counterId));
    expect(
      requireRejectedDecision(
        Domain.decrementCounter()(activeCounter()),
        "CounterMinimumReached",
        "minimum counter",
      ),
    ).toEqual(Domain.counterMinimumReached(counterId));
    expect(Domain.counterAlreadyExists(counterId)).toEqual({
      _tag: "CounterAlreadyExists",
      counterId,
    });
    expect(Domain.counterDoesNotExist(counterId)).toEqual({
      _tag: "CounterDoesNotExist",
      counterId,
    });
    expect(Domain.counterMinimumReached(counterId)).toEqual({
      _tag: "CounterMinimumReached",
      counterId,
    });
    expect(Domain.counterMaximumReached(counterId)).toEqual({
      _tag: "CounterMaximumReached",
      counterId,
    });
    expect(Domain.counterIsDisabled(counterId)).toEqual({
      _tag: "CounterIsDisabled",
      counterId,
    });
    expect(() => Schema.decodeUnknownSync(Domain.CounterAlreadyExists)({})).toThrow();
    expect(() => Schema.decodeUnknownSync(Domain.CounterDoesNotExist)({})).toThrow();
    expect(() => Schema.decodeUnknownSync(Domain.CounterIsDisabled)({})).toThrow();
    expect(() => Schema.decodeUnknownSync(Domain.CounterMinimumReached)({})).toThrow();
    expect(() => Schema.decodeUnknownSync(Domain.CounterMaximumReached)({})).toThrow();
    expect(
      requireRejectedDecision(
        Domain.incrementCounter()(incrementedCounter(5)),
        "CounterMaximumReached",
        "maximum counter",
      ),
    ).toEqual(Domain.counterMaximumReached(counterId));
  });

  test("disabled counters cannot change or be re-enabled", () => {
    const disabled = requireAcceptedDecision(
      Domain.disableCounter()(incrementedCounter(1)),
      "disable counter decision",
    );

    expect(disabled.state).toEqual(
      Domain.DisabledCounter.make({
        counterId,
        value: 1,
      }),
    );
    expect(
      requireRejectedDecision(
        Domain.incrementCounter()(disabled),
        "CounterIsDisabled",
        "disabled increment",
      ),
    ).toEqual(Domain.counterIsDisabled(counterId));
    expect(
      requireRejectedDecision(
        Domain.decrementCounter()(disabled),
        "CounterIsDisabled",
        "disabled decrement",
      ),
    ).toEqual(Domain.counterIsDisabled(counterId));
    expect(
      requireRejectedDecision(
        Domain.disableCounter()(disabled),
        "CounterIsDisabled",
        "already disabled",
      ),
    ).toEqual(Domain.counterIsDisabled(counterId));
  });
});
