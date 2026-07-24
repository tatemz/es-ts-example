import * as BunServices from "@effect/platform-bun/BunServices";
import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import { captureLogs, testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { DomainEventStore, main, makeInProcessRpcClient, eventStoreFor } from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-json");
const jsonFilePath = "/tmp/es-poc-application-index-events.json";

testEffect("application main logs readiness", () =>
  Effect.map(captureLogs(main()), (logs) => {
    expect(logs).toEqual(["application ready"]);
  }),
);

test("domain event store tag carries its service key", () => {
  expect(DomainEventStore.key).toBe("DomainEventStore");
});

testEffect("in-process rpc client acknowledges streaming chunks", () => {
  const Numbers = Rpc.make("Numbers", {
    success: Schema.Number,
    stream: true,
  });
  const NumbersApi = RpcGroup.make(Numbers);
  const NumbersHandlers = NumbersApi.toLayer(
    NumbersApi.of({
      Numbers: () => Stream.fromIterable([1, 2]),
    }),
  );

  return Effect.gen(function* () {
    const client = yield* makeInProcessRpcClient(NumbersApi);
    const numbers = yield* client
      .Numbers(void 0)
      .pipe(Stream.runCollect, Effect.timeout("1 second"));

    expect(Arr.fromIterable(numbers)).toEqual([1, 2]);
  }).pipe(Effect.provide(NumbersHandlers), Effect.scoped);
});

testEffect("json-file event store persists and replays counter events", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.ignore(fs.remove(jsonFilePath));

    const fileStore = yield* DomainEventStore.pipe(
      Effect.provide(DomainEventStore.jsonFile(jsonFilePath)),
      Effect.provide(BunServices.layer),
    );
    const counterStore = eventStoreFor(Domain.CounterEvent, fileStore);

    const created = Domain.CounterCreated.make({ counterId });
    const incremented = Domain.CounterIncremented.make({ counterId });

    yield* counterStore.append({
      aggregateId: counterId,
      expectedVersion: 0,
      events: [created, incremented],
    });

    const fetched = yield* counterStore.fetch({ aggregateId: counterId });
    const streamed = yield* Stream.runCollect(counterStore.fetchAll({}));

    expect(Arr.map(fetched, (record) => record.event)).toEqual([created, incremented]);
    expect(Arr.map(Arr.fromIterable(streamed), (record) => record.event)).toEqual([
      created,
      incremented,
    ]);

    yield* Effect.ignore(fs.remove(jsonFilePath));
  }).pipe(Effect.provide(BunServices.layer)),
);

testEffect("a narrowed event store skips other slices' events on every read", () =>
  Effect.gen(function* () {
    const broad = yield* DomainEventStore;
    const counterStore = eventStoreFor(Domain.CounterEvent, broad);
    const created = Domain.CounterCreated.make({ counterId });
    const incremented = Domain.CounterIncremented.make({ counterId });

    yield* counterStore.append({
      aggregateId: counterId,
      expectedVersion: 0,
      events: [created, incremented],
    });

    // A narrower slice of the same stream: only creation facts belong to it.
    const createdOnly = eventStoreFor(Domain.CounterCreated, broad);
    const fetched = yield* createdOnly.fetch({ aggregateId: counterId });
    const streamed = yield* Stream.runCollect(createdOnly.fetchAll({}));

    // fetch and fetchAll answer the same question the same way.
    expect({
      fetched: Arr.map(fetched, (record) => record.event),
      streamed: Arr.map(Arr.fromIterable(streamed), (record) => record.event),
    }).toEqual({ fetched: [created], streamed: [created] });
  }).pipe(Effect.provide(DomainEventStore.inMemory)),
);
