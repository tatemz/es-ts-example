#!/usr/bin/env bun
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunServices from "@effect/platform-bun/BunServices";
import { WebHttpApp } from "@es-ts-example/web/server";
import * as WebConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import {
  localRpcClients,
  parseStorageBackend,
  WebRuntimeConfig,
  type WebRuntimeStorageConfig,
} from "./runtime.ts";

const rootDotEnvPath = `${import.meta.dir}/../../../.env`;

const optionalRootDotEnvProvider = WebConfigProvider.fromDotEnv({ path: rootDotEnvPath }).pipe(
  Effect.catchCause(() => Effect.succeed(WebConfigProvider.fromUnknown({}))),
);

const webConfigProvider = optionalRootDotEnvProvider.pipe(
  Effect.map((dotEnvProvider) =>
    WebConfigProvider.orElse(WebConfigProvider.fromEnv(), dotEnvProvider),
  ),
);

const serve = (runtimeConfig: WebRuntimeStorageConfig & { readonly port: number }) =>
  Layer.launch(
    HttpRouter.serve(WebHttpApp, { disableLogger: true }).pipe(
      Layer.provide(BunHttpServer.layer({ port: runtimeConfig.port })),
    ),
  );

const program = Effect.gen(function* () {
  const provider = yield* webConfigProvider;
  const config = yield* WebRuntimeConfig.parse(provider);
  const storageBackend = yield* parseStorageBackend(config.storageBackend);
  const runtimeConfig = { ...config, storageBackend };

  yield* serve(runtimeConfig).pipe(Effect.provide(localRpcClients(runtimeConfig)));
}).pipe(Effect.provide(BunServices.layer), Effect.scoped);

void Effect.runPromise(program as Effect.Effect<void, unknown, never>);
