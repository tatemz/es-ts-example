import { describe, expect, test } from "bun:test";
import {
  requireAcceptedDecision,
  requireRejectedDecision,
} from "@es-ts-example/test-support/Decision";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Schema from "effect/Schema";
import * as Domain from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");

const newCounter = (): Domain.CounterAggregate => Domain.newCounter(counterId);

const activeCounter = (): Domain.CounterAggregate =>
  requireAcceptedDecision(
    Domain.createCounter({ counterId })(newCounter()),
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
    // Every counter fact names its counter. The shared event stream is grouped
    // by this field, so an event without it cannot be attributed to a counter.
    expect(() =>
      Schema.decodeUnknownSync(Domain.CounterIncremented)({ _tag: "CounterIncremented" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Domain.CounterDecremented)({ _tag: "CounterDecremented" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Domain.CounterDisabled)({ _tag: "CounterDisabled" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(Domain.DisabledCounter)({ _tag: "DisabledCounter" }),
    ).toThrow();
    expect(newCounter()).toEqual({
      aggregateId: counterId,
      state: Domain.CounterNotCreated.make({}),
      version: 0,
      pendingEvents: [],
    });
    expect(newCounter().state).toHaveProperty("_tag", "CounterNotCreated");

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

  test("replays counter history", () => {
    const replayed = Domain.replayCounter(counterId)([
      Domain.CounterCreated.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterDisabled.make({ counterId }),
    ]);

    expect(replayed).toEqual({
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
        Domain.incrementCounter()(newCounter()),
        "CounterDoesNotExist",
        "missing counter increment",
      ),
    ).toEqual(Domain.counterDoesNotExist(counterId));
    expect(
      requireRejectedDecision(
        Domain.decrementCounter()(newCounter()),
        "CounterDoesNotExist",
        "missing counter decrement",
      ),
    ).toEqual(Domain.counterDoesNotExist(counterId));
    expect(
      requireRejectedDecision(
        Domain.disableCounter()(newCounter()),
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

  test("keeps replay total for logs the decisions would never write", () => {
    const replay = (...events: ReadonlyArray<Domain.CounterEvent>): Domain.CounterState =>
      Domain.counterStateFrom(events);

    const created = Domain.CounterCreated.make({ counterId });
    const incremented = Domain.CounterIncremented.make({ counterId });
    const decremented = Domain.CounterDecremented.make({ counterId });
    const disabled = Domain.CounterDisabled.make({ counterId });
    const notCreated = Domain.CounterNotCreated.make({});

    // Nothing but creation starts a stream.
    expect(replay(incremented)).toEqual(notCreated);
    expect(replay(decremented)).toEqual(notCreated);
    expect(replay(disabled)).toEqual(notCreated);

    // A second creation fact does not reset an existing counter.
    expect(replay(created, incremented, created)).toEqual(
      Domain.ActiveCounter.make({ counterId, value: 1 }),
    );

    // Disabling freezes: no later fact reopens or moves the counter.
    expect(replay(created, incremented, disabled, incremented, decremented, created)).toEqual(
      Domain.DisabledCounter.make({ counterId, value: 1 }),
    );

    // Replay clamps rather than throwing when a log runs past the domain bounds.
    expect(replay(created, ...Arr.replicate(incremented, 9))).toEqual(
      Domain.ActiveCounter.make({ counterId, value: Domain.maximumCounterValue }),
    );
    expect(replay(created, decremented, decremented)).toEqual(
      Domain.ActiveCounter.make({ counterId, value: Domain.minimumCounterValue }),
    );
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
