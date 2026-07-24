import * as Context from "effect/Context";
import type * as RpcClient from "effect/unstable/rpc/RpcClient";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import type { CounterCommandApi, CounterQueryApi } from "./rpc.ts";

export type CounterCommandClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof CounterCommandApi>>;
export const CounterCommandClient = Context.Service<CounterCommandClient>("CounterCommandClient");

export type CounterQueryClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof CounterQueryApi>>;
export const CounterQueryClient = Context.Service<CounterQueryClient>("CounterQueryClient");
