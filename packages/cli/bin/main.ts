#!/usr/bin/env bun
import * as BunServices from "@effect/platform-bun/BunServices";
import { runEffectMain } from "@es-ts-example/test-support/run-effect-main";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { runCli } from "../src/index.ts";

const eventStoreFile = Config.string("EVENT_STORE_FILE").pipe(
  Config.withDefault(`${process.cwd()}/.counter-events.json`),
);

const program = Effect.gen(function* () {
  const filePath = yield* eventStoreFile;
  const lines = yield* runCli(Arr.drop(Bun.argv, 2), filePath);
  yield* Effect.forEach(lines, (line) => Console.log(line));
}).pipe(Effect.provide(BunServices.layer));

runEffectMain(program);
