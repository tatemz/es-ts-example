import * as Layer from "effect/Layer";
import { makeInProcessRpcClient } from "../rpc/inProcess.ts";
import { CounterCommandHandlers, CounterQueryHandlers } from "./handlers.ts";
import { CounterCommandApi, CounterQueryApi } from "./rpc.ts";
import { CounterCommandClient, CounterQueryClient } from "./services.ts";

export const CounterCommandClientLive = Layer.effect(
  CounterCommandClient,
  makeInProcessRpcClient(CounterCommandApi),
).pipe(Layer.provide(CounterCommandHandlers));

export const CounterQueryClientLive = Layer.effect(
  CounterQueryClient,
  makeInProcessRpcClient(CounterQueryApi),
).pipe(Layer.provide(CounterQueryHandlers));
