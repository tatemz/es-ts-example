import * as Application from "@es-ts-example/application";
import * as WebConfig from "effect/Config";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import type { WebRuntimeStorageConfig } from "../src/runtime-config.ts";
export { parseStorageBackend, type WebRuntimeStorageConfig } from "../src/runtime-config.ts";

export const WebRuntimeConfig = WebConfig.all({
  port: WebConfig.port("PORT").pipe(WebConfig.withDefault(3000)),
  storageBackend: WebConfig.string("STORAGE_BACKEND").pipe(WebConfig.withDefault("json-file")),
  eventStoreFile: WebConfig.string("EVENT_STORE_FILE").pipe(
    WebConfig.withDefault(`${process.cwd()}/.counter-events.json`),
  ),
});

const storageLayer = (config: WebRuntimeStorageConfig) =>
  Match.value(config.storageBackend).pipe(
    Match.when("memory", () => Application.DomainEventStore.inMemory),
    Match.when("json-file", () => Application.DomainEventStore.jsonFile(config.eventStoreFile)),
    Match.exhaustive,
  );

export const localRpcClients = (config: WebRuntimeStorageConfig) =>
  Layer.mergeAll(
    Application.CounterCommandClientLive,
    Application.CounterQueryClientLive,
    Application.UserCommandClientLive,
    Application.UserQueryClientLive,
  ).pipe(Layer.provide(storageLayer(config)));
