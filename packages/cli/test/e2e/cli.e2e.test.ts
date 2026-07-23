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
