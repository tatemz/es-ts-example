import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

type InProcessRpcClient<Rpcs extends Rpc.Any> = Effect.Success<
  ReturnType<typeof RpcClient.makeNoSerialization<Rpcs, never>>
>;

export const makeInProcessRpcClient = <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
): Effect.Effect<
  RpcClient.RpcClient<Rpcs>,
  never,
  Scope.Scope | Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs> | Rpc.MiddlewareClient<Rpcs>
> =>
  Effect.gen(function* () {
    const clientWrite = yield* Deferred.make<InProcessRpcClient<Rpcs>["write"]>();
    const server = yield* RpcServer.makeNoSerialization(group, {
      onFromServer: (response) =>
        Effect.flatMap(Deferred.await(clientWrite), (write) => write(response)),
    });

    const client = yield* RpcClient.makeNoSerialization(group, {
      supportsAck: true,
      onFromClient: ({ message }) => server.write(0, message),
    });
    yield* Deferred.succeed(clientWrite, client.write);

    return client.client;
  });
