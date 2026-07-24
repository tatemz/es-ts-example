import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  CounterCommand,
  CounterCommandClient,
  CounterCommandClientLive,
  CounterCommandError,
  CounterCommandReceipt,
  CounterDomainError,
  CounterList,
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
  makeCounterCommandHandler,
  makeListCountersHandler,
} from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");
const secondCounterId = Domain.CounterId.make("counter-2");

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
        counterId,
        value: 0,
        status: "disabled",
        version: 4,
      },
      {
        counterId: secondCounterId,
        value: 0,
        status: "active",
        version: 1,
      },
    ]);
  }),
);

test("counter read models cover empty, active, and disabled aggregates", () => {
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
  expect({ created, active, disabled }).toEqual({
    created: { counterId, value: 0, status: "active", version: 0 },
    active: { counterId, value: 0, status: "active", version: 1 },
    disabled: { counterId, value: 0, status: "disabled", version: 2 },
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
