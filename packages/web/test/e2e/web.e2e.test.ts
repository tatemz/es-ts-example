import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "bun:test";
import * as Application from "@es-ts-example/application";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { getArticlesPageController } from "../../src/controllers/getArticlesPage.controller.ts";
import { getCounterPageController } from "../../src/controllers/getCounterPage.controller.ts";
import { postCounterCommandController } from "../../src/controllers/postCounterCommand.controller.ts";
import { postCreateCounterController } from "../../src/controllers/postCreateCounter.controller.ts";
import { postToggleBookmarkController } from "../../src/controllers/postToggleBookmark.controller.ts";
import {
  ArticleQueryRpcClient,
  BookmarkCommandRpcClient,
  CommandRpcClient,
  QueryRpcClient,
} from "../../src/rpcClients.ts";

const clients = (path: string) =>
  Layer.mergeAll(
    CommandRpcClient.local,
    QueryRpcClient.local,
    BookmarkCommandRpcClient.local,
    ArticleQueryRpcClient.local,
  ).pipe(Layer.provide(Application.DomainEventStore.jsonFile(path)));

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

testEffect("bookmark actions persist projected article state across web requests", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const bookmarkPath = `/tmp/es-web-bookmark-e2e-${process.pid}.json`;
    yield* Effect.ignore(fs.remove(bookmarkPath));

    yield* postToggleBookmarkController({ articleId: "events-over-state" });
    const page = yield* getArticlesPageController({});
    const contents = yield* fs.readFileString(bookmarkPath);
    yield* Effect.ignore(fs.remove(bookmarkPath));

    const firstRow = page.list._tag === "ArticleListPopulated" ? page.list.rows[0] : undefined;

    expect({
      bookmark: firstRow?.bookmark._tag,
      storedBookmarked: contents.includes("ArticleBookmarked"),
    }).toEqual({
      bookmark: "ArticleSaved",
      storedBookmarked: true,
    });
  }).pipe(
    Effect.provide(clients(`/tmp/es-web-bookmark-e2e-${process.pid}.json`)),
    Effect.provide(BunServices.layer),
  ),
);
