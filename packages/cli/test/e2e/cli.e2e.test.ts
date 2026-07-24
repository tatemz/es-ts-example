import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "bun:test";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { runCli } from "../../src/index.ts";

testEffect("counters persist across separate cli invocations sharing one event log", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = `/tmp/es-cli-e2e-${process.pid}.json`;
    yield* Effect.ignore(fs.remove(path));

    yield* runCli(["create", "alpha"], path);
    yield* runCli(["increment", "alpha"], path);
    yield* runCli(["create", "beta"], path);
    const listed = yield* runCli(["list"], path);

    yield* Effect.ignore(fs.remove(path));

    expect(listed).toEqual([
      "Counters:",
      "#alpha value=1 status=active version=2",
      "#beta value=0 status=active version=1",
    ]);
  }).pipe(Effect.provide(BunServices.layer)),
);

testEffect("bookmarks persist across separate cli invocations sharing one event log", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = `/tmp/es-cli-bookmark-e2e-${process.pid}.json`;
    yield* Effect.ignore(fs.remove(path));

    yield* runCli(["bookmark", "user-1", "events-over-state"], path);
    const listed = yield* runCli(["articles", "user-1"], path);
    const contents = yield* fs.readFileString(path);

    yield* Effect.ignore(fs.remove(path));

    expect({
      firstArticle: listed[1],
      storedBookmarked: contents.includes("ArticleBookmarked"),
    }).toEqual({
      firstArticle: '#events-over-state "Events Over State" [bookmarked]',
      storedBookmarked: true,
    });
  }).pipe(Effect.provide(BunServices.layer)),
);
