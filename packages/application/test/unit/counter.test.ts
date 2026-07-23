import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Schema from "effect/Schema";
import {
  applyCounterListEvent,
  CounterCommand,
  CounterCommandClient,
  CounterCommandClientLive,
  CounterCommandError,
  CounterCommandReceipt,
  CounterDomainError,
  CounterList,
  CounterListProjection,
  CounterQueryClient,
  CounterQueryClientLive,
  CreateCounter,
  type CreateCounterCommand,
  counterMetadata,
  counterReadFromAggregate,
  DecrementCounter,
  DisableCounter,
  DomainEventStore,
  IncrementCounter,
  ListCounters,
  makeCreateCounterHandler,
  makeDecrementCounterHandler,
  makeDisableCounterHandler,
  makeIncrementCounterHandler,
  makeListCountersHandler,
} from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");

test("counter rpc contracts expose command and query procedures", () => {
  const createPayload: CreateCounterCommand = { _tag: "CreateCounter", counterId };
  const receipt: CounterCommandReceipt = { counterId, value: 0, status: "active", version: 1 };
  const list: CounterList = { counters: [receipt] };

  expect(CreateCounter).toHaveProperty("_tag", "CreateCounter");
  expect(IncrementCounter).toHaveProperty("_tag", "IncrementCounter");
  expect(DecrementCounter).toHaveProperty("_tag", "DecrementCounter");
  expect(DisableCounter).toHaveProperty("_tag", "DisableCounter");
  expect(ListCounters).toHaveProperty("_tag", "ListCounters");
  expect(Schema.decodeUnknownSync(CreateCounter.payloadSchema)(createPayload)).toEqual(
    createPayload,
  );
  expect(Schema.decodeUnknownSync(CounterCommandReceipt)(receipt)).toEqual(receipt);
  expect(Schema.decodeUnknownSync(CounterList)(list)).toEqual(list);
  expect(
    Schema.decodeUnknownSync(CounterDomainError)(Domain.counterMaximumReached(counterId)),
  ).toEqual(Domain.counterMaximumReached(counterId));
  expect(
    Schema.decodeUnknownSync(CounterCommandError)(Domain.counterMaximumReached(counterId)),
  ).toEqual(Domain.counterMaximumReached(counterId));
  expect(Schema.is(CounterCommand)({ _tag: "CreateCounter", counterId })).toBe(true);
  expect(Schema.is(CounterCommand)({ _tag: "IncrementCounter", counterId })).toBe(true);
  expect(Schema.is(CounterCommand)({ _tag: "DecrementCounter", counterId })).toBe(true);
  expect(Schema.is(CounterCommand)({ _tag: "DisableCounter", counterId })).toBe(true);
  expect(Schema.is(CounterCommand)({ _tag: "BogusCounter", counterId })).toBe(false);
  expect(() => Schema.decodeUnknownSync(CounterCommandReceipt)({})).toThrow();
  expect(() => Schema.decodeUnknownSync(CounterList)({})).toThrow();
  expect(CounterCommandClient.key).toBe("CounterCommandClient");
  expect(CounterQueryClient.key).toBe("CounterQueryClient");
  expect(CounterListProjection.projectionId).toBe("counter-list");
  expect(counterMetadata({ _tag: "CreateCounter", counterId })).toEqual({
    correlationId: "CreateCounter:counter-1",
    causationId: undefined,
  });
  expect(
    counterMetadata({
      _tag: "CreateCounter",
      counterId,
      correlationId: "corr-1",
      causationId: "cause-1",
    }),
  ).toEqual({
    correlationId: "corr-1",
    causationId: "cause-1",
  });
});

testEffect("counter handlers write events and list projected counters", () =>
  Effect.gen(function* () {
    const store = yield* EventStore.makeInMemoryEventStore<Domain.CounterEvent>();
    const createCounter = makeCreateCounterHandler(store);
    const incrementCounter = makeIncrementCounterHandler(store);
    const decrementCounter = makeDecrementCounterHandler(store);
    const disableCounter = makeDisableCounterHandler(store);
    const listCounters = makeListCountersHandler(store);

    yield* createCounter({ _tag: "CreateCounter", counterId });
    const incremented = yield* incrementCounter({ _tag: "IncrementCounter", counterId });
    const decremented = yield* decrementCounter({ _tag: "DecrementCounter", counterId });
    const disabled = yield* disableCounter({ _tag: "DisableCounter", counterId });
    const projection = yield* listCounters();

    expect(incremented.state).toEqual(
      Domain.ActiveCounter.make({
        counterId,
        value: 1,
      }),
    );
    expect(decremented.state).toEqual(Domain.ActiveCounter.make({ counterId, value: 0 }));
    expect(disabled.state).toEqual(Domain.DisabledCounter.make({ counterId, value: 0 }));
    expect(projection.counters).toEqual([
      {
        counterId,
        value: 0,
        status: "disabled",
        version: 4,
      },
    ]);
  }),
);

test("counter read models cover empty, active, disabled, and projected changes", () => {
  const created = counterReadFromAggregate(Domain.emptyCounter(counterId));
  const active = counterReadFromAggregate(
    Domain.recordCounterEvent(
      Domain.emptyCounter(counterId),
      Domain.CounterCreated.make({ counterId }),
    ),
  );
  const disabled = counterReadFromAggregate(
    Domain.recordCounterEvent(
      Domain.recordCounterEvent(
        Domain.emptyCounter(counterId),
        Domain.CounterCreated.make({ counterId }),
      ),
      Domain.CounterDisabled.make({ counterId }),
    ),
  );
  const projected = Fn.pipe(
    [
      Domain.CounterCreated.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterDecremented.make({ counterId }),
      Domain.CounterDisabled.make({ counterId }),
    ],
    Arr.reduce({ counters: [] }, applyCounterListEvent),
  );
  const secondCounterId = Domain.CounterId.make("counter-2");
  const multiCounterProjection = Fn.pipe(
    [
      Domain.CounterCreated.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
      Domain.CounterCreated.make({ counterId: secondCounterId }),
      Domain.CounterDisabled.make({ counterId }),
      Domain.CounterIncremented.make({ counterId }),
    ],
    Arr.reduce({ counters: [] }, applyCounterListEvent),
  );
  const incrementBeforeCreateProjection = applyCounterListEvent(
    { counters: [] },
    Domain.CounterIncremented.make({ counterId }),
  );

  expect({ created, active, disabled, projected }).toEqual({
    created: { counterId, value: 0, status: "active", version: 0 },
    active: { counterId, value: 0, status: "active", version: 1 },
    disabled: { counterId, value: 0, status: "disabled", version: 2 },
    projected: {
      counters: [{ counterId, value: 0, status: "disabled", version: 4 }],
    },
  });
  expect(multiCounterProjection).toEqual({
    counters: [
      { counterId, value: 3, status: "disabled", version: 5 },
      { counterId: secondCounterId, value: 0, status: "active", version: 1 },
    ],
  });
  expect(incrementBeforeCreateProjection).toEqual({
    counters: [{ counterId, value: 1, status: "active", version: 1 }],
  });
});

testEffect("counter live clients round-trip through in-process rpc", () =>
  Effect.gen(function* () {
    const commands = yield* CounterCommandClient;
    const queries = yield* CounterQueryClient;

    yield* commands.CreateCounter({ _tag: "CreateCounter", counterId });
    yield* commands.IncrementCounter({ _tag: "IncrementCounter", counterId });
    yield* commands.DecrementCounter({ _tag: "DecrementCounter", counterId });
    yield* commands.DisableCounter({ _tag: "DisableCounter", counterId });

    const result = yield* queries.ListCounters({});

    expect(result).toEqual({
      counters: [
        {
          counterId,
          value: 0,
          status: "disabled",
          version: 4,
        },
      ],
    });
  }).pipe(
    Effect.provide(CounterCommandClientLive),
    Effect.provide(CounterQueryClientLive),
    Effect.provide(DomainEventStore.inMemory),
  ),
);
