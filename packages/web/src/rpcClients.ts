import * as Application from "@es-ts-example/application";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

type CounterCommandHandler<Tag extends Application.CounterCommand["_tag"]> = (
  command: Extract<Application.CounterCommand, { readonly _tag?: Tag }>,
) => Effect.Effect<Application.CounterCommandReceipt, unknown>;

export type CounterCommandRpcClient = {
  readonly [Tag in Application.CounterCommand["_tag"]]: CounterCommandHandler<Tag>;
};

export type CounterQueryRpcClient = {
  readonly ListCounters: (
    query: Readonly<Record<PropertyKey, never>>,
  ) => Effect.Effect<Application.CounterList, unknown>;
};

export type CommandRpcClient = CounterCommandRpcClient;
const CommandRpcClientTag = Context.Service<CommandRpcClient>("CommandRpcClient");
export const CommandRpcClient = Object.assign(CommandRpcClientTag, {
  local: Layer.effect(CommandRpcClientTag, Application.CounterCommandClient).pipe(
    Layer.provide(Application.CounterCommandClientLive),
  ),
});

export type QueryRpcClient = CounterQueryRpcClient;
const QueryRpcClientTag = Context.Service<QueryRpcClient>("QueryRpcClient");
export const QueryRpcClient = Object.assign(QueryRpcClientTag, {
  local: Layer.effect(QueryRpcClientTag, Application.CounterQueryClient).pipe(
    Layer.provide(Application.CounterQueryClientLive),
  ),
});
