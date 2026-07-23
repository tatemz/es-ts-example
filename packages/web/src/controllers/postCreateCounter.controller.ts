import * as Application from "@es-ts-example/application";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { CommandRpcClient } from "../rpcClients.ts";
import { counterHomeHref } from "../routes.ts";

export type PostCreateCounterInput = {
  readonly counterId: string;
};

export const postCreateCounterController = (
  input: PostCreateCounterInput,
): Effect.Effect<string, never, CommandRpcClient> => {
  const trimmed = Str.trim(input.counterId);

  if (trimmed === "") {
    return Effect.succeed(counterHomeHref({ error: "missing-id" }));
  }

  return Effect.gen(function* () {
    const commands = yield* CommandRpcClient;
    yield* commands.CreateCounter({
      _tag: "CreateCounter",
      counterId: Application.CounterId.make(trimmed),
    });
    return counterHomeHref({});
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(counterHomeHref({ error: "command-failed", newCounterId: trimmed })),
    ),
  );
};
