import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  CounterCommand,
  CounterCommandClient,
  CounterCommandClientLive,
  CounterCommandError,
  CounterCommandReceipt,
  CounterDomainError,
  type CounterList,
  CounterQueryClient,
  CounterQueryClientLive,
  type CounterSummary,
  CreateCounter,
  type CreateCounterCommand,
  counterSummaryOf,
  DecrementCounter,
  DisableCounter,
  DomainEventStore,
  IncrementCounter,
  ListCounters,
  makeCounterCommandHandler,
  makeListCountersHandler,
} from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");
const secondCounterId = Domain.CounterId.make("counter-2");

test("counter rpc contracts expose command and query procedures", () => {
  const createPayload: CreateCounterCommand = { _tag: "CreateCounter", counterId };
  const receipt: CounterCommandReceipt = { counterId, version: 1 };
  const summary: CounterSummary = {
    _tag: "ActiveCounterSummary",
    counterId,
    value: 0,
    version: 1,
  };
  const list: CounterList = { counters: [summary] };

  expect(CreateCounter).toHaveProperty("_tag", "CreateCounter");
  expect(IncrementCounter).toHaveProperty("_tag", "IncrementCounter");
  expect(DecrementCounter).toHaveProperty("_tag", "DecrementCounter");
  expect(DisableCounter).toHaveProperty("_tag", "DisableCounter");
  expect(ListCounters).toHaveProperty("_tag", "ListCounters");
  expect(Schema.decodeUnknownSync(CreateCounter.payloadSchema)(createPayload)).toEqual(
    createPayload,
  );
  expect(Schema.decodeUnknownSync(CounterCommandReceipt)(receipt)).toEqual(receipt);
  expect(Schema.decodeUnknownSync(ListCounters.successSchema)(list)).toEqual(list);
  expect(Schema.decodeUnknownSync(ListCounters.payloadSchema)({})).toEqual({});
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
  expect(
    Schema.is(ListCounters.errorSchema)(
      EventStore.EventStorePersistenceFailure.make({ message: "failed" }),
    ),
  ).toBe(true);
  expect(() => Schema.decodeUnknownSync(CounterCommandReceipt)({})).toThrow();
  expect(() => Schema.decodeUnknownSync(ListCounters.successSchema)({})).toThrow();
  expect(CounterCommandClient.key).toBe("CounterCommandClient");
  expect(CounterQueryClient.key).toBe("CounterQueryClient");
});

testEffect("counter handlers write events and list projected counters", () =>
  Effect.gen(function* () {
    const store = yield* EventStore.makeInMemoryEventStore<Domain.CounterEvent>();
    const handle = makeCounterCommandHandler(store);
    const listCounters = makeListCountersHandler(store);

    yield* handle({ _tag: "CreateCounter", counterId });
    const incremented = yield* handle({ _tag: "IncrementCounter", counterId });
    const decremented = yield* handle({ _tag: "DecrementCounter", counterId });
    const disabled = yield* handle({ _tag: "DisableCounter", counterId });
    yield* handle({ _tag: "CreateCounter", counterId: secondCounterId });
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
        _tag: "DisabledCounterSummary",
        counterId,
        value: 0,
        version: 4,
      },
      {
        _tag: "ActiveCounterSummary",
        counterId: secondCounterId,
        value: 0,
        version: 1,
      },
    ]);
  }),
);

test("counter summaries describe only counters that exist", () => {
  const active = counterSummaryOf(
    Domain.recordCounterEvent(
      Domain.newCounter(counterId),
      Domain.CounterCreated.make({ counterId }),
    ),
  );
  const disabled = counterSummaryOf(
    Domain.recordCounterEvent(
      Domain.recordCounterEvent(
        Domain.newCounter(counterId),
        Domain.CounterCreated.make({ counterId }),
      ),
      Domain.CounterDisabled.make({ counterId }),
    ),
  );
  // A log that never created its counter has nothing to summarise.
  const uncreated = counterSummaryOf(
    Domain.replayCounter(counterId)([Domain.CounterIncremented.make({ counterId })]),
  );

  expect({ active, disabled, uncreated }).toEqual({
    active: Option.some({
      _tag: "ActiveCounterSummary",
      counterId,
      value: 0,
      version: 1,
    }),
    disabled: Option.some({
      _tag: "DisabledCounterSummary",
      counterId,
      value: 0,
      version: 2,
    }),
    uncreated: Option.none(),
  });
});

testEffect("listing drops streams whose log never created a counter", () =>
  Effect.gen(function* () {
    const store = yield* EventStore.makeInMemoryEventStore<Domain.CounterEvent>();

    // A log the decisions would never write, but the store can still hold.
    yield* store.append({
      aggregateId: counterId,
      expectedVersion: 0,
      events: [Domain.CounterIncremented.make({ counterId })],
    });
    yield* makeCounterCommandHandler(store)({
      _tag: "CreateCounter",
      counterId: secondCounterId,
    });

    expect(yield* makeListCountersHandler(store)()).toEqual({
      counters: [
        {
          _tag: "ActiveCounterSummary",
          counterId: secondCounterId,
          value: 0,
          version: 1,
        },
      ],
    });
  }),
);

testEffect("counter live clients round-trip through in-process rpc", () =>
  Effect.gen(function* () {
    const commands = yield* CounterCommandClient;
    const queries = yield* CounterQueryClient;

    const created = yield* commands.CreateCounter({ _tag: "CreateCounter", counterId });
    yield* commands.IncrementCounter({ _tag: "IncrementCounter", counterId });
    yield* commands.DecrementCounter({ _tag: "DecrementCounter", counterId });
    const disabled = yield* commands.DisableCounter({ _tag: "DisableCounter", counterId });

    const result = yield* queries.ListCounters({});

    // Each receipt acknowledges the write at the version it produced.
    expect({ created, disabled, result }).toEqual({
      created: { counterId, version: 1 },
      disabled: { counterId, version: 4 },
      result: {
        counters: [
          {
            _tag: "DisabledCounterSummary",
            counterId,
            value: 0,
            version: 4,
          },
        ],
      },
    });
  }).pipe(
    Effect.provide(CounterCommandClientLive),
    Effect.provide(CounterQueryClientLive),
    Effect.provide(DomainEventStore.inMemory),
  ),
);
