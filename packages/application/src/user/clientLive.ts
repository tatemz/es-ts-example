import * as Layer from "effect/Layer";
import { makeInProcessRpcClient } from "../rpc/inProcess.ts";
import { UserCommandHandlers, UserQueryHandlers } from "./handlers.ts";
import { UserCommandApi, UserQueryApi } from "./rpc.ts";
import { UserCommandClient, UserQueryClient } from "./services.ts";

export const UserCommandClientLive = Layer.effect(
  UserCommandClient,
  makeInProcessRpcClient(UserCommandApi),
).pipe(Layer.provide(UserCommandHandlers));

export const UserQueryClientLive = Layer.effect(
  UserQueryClient,
  makeInProcessRpcClient(UserQueryApi),
).pipe(Layer.provide(UserQueryHandlers));
