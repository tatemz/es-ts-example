import * as Context from "effect/Context";
import type * as RpcClient from "effect/unstable/rpc/RpcClient";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { UserCommandApi, UserQueryApi } from "./rpc.ts";

export type UserCommandClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof UserCommandApi>>;
export const UserCommandClient = Context.Service<UserCommandClient>("UserCommandClient");

export type UserQueryClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof UserQueryApi>>;
export const UserQueryClient = Context.Service<UserQueryClient>("UserQueryClient");
