import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "bun:test";
import * as Application from "@es-ts-example/application";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { getCounterPageController } from "../../src/controllers/getCounterPage.controller.ts";
import { postCounterCommandController } from "../../src/controllers/postCounterCommand.controller.ts";
import { postCreateCounterController } from "../../src/controllers/postCreateCounter.controller.ts";
import { CommandRpcClient, QueryRpcClient } from "../../src/rpcClients.ts";

const clients = (path: string) =>
  Layer.mergeAll(CommandRpcClient.local, QueryRpcClient.local).pipe(
    Layer.provide(Application.DomainEventStore.jsonFile(path)),
  );

const path = `/tmp/es-web-e2e-${process.pid}.json`;

testEffect("counter commands persist a replayable json event log across web requests", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.ignore(fs.remove(path));

    yield* postCreateCounterController({ counterId: "alpha" });
    yield* postCounterCommandController({ counterId: "alpha", verb: "increment" });
    yield* postCreateCounterController({ counterId: "beta" });

    const page = yield* getCounterPageController({});
    const contents = yield* fs.readFileString(path);
    yield* Effect.ignore(fs.remove(path));

    const rows =
      page.list._tag === "CounterListPopulated"
        ? Arr.map(page.list.rows, (row) => `${row.counterId} ${row.valueText}`)
        : [];

    expect({ rows, storedCreated: contents.includes("CounterCreated") }).toEqual({
      rows: ["alpha value=1", "beta value=0"],
      storedCreated: true,
    });
  }).pipe(Effect.provide(clients(path)), Effect.provide(BunServices.layer)),
);
