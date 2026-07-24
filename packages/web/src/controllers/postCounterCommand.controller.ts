import * as Application from "@es-ts-example/application";
import * as Effect from "effect/Effect";
import { counterHomeHref } from "../routes.ts";

export type PostCounterCommandInput = {
  readonly counterId: string;
  readonly verb: string;
};

const runVerb = (
  commands: Application.CounterCommandClient,
  verb: string,
  counterId: Application.CounterId,
): Effect.Effect<Application.CounterCommandReceipt, Application.CounterCommandError | Error> => {
  if (verb === "increment") {
    return commands.IncrementCounter({ _tag: "IncrementCounter", counterId });
  }
  if (verb === "decrement") {
    return commands.DecrementCounter({ _tag: "DecrementCounter", counterId });
  }
  if (verb === "disable") {
    return commands.DisableCounter({ _tag: "DisableCounter", counterId });
  }
  return Effect.fail(new Error());
};

export const postCounterCommandController = (
  input: PostCounterCommandInput,
): Effect.Effect<string, never, Application.CounterCommandClient> =>
  Effect.gen(function* () {
    const commands = yield* Application.CounterCommandClient;
    yield* runVerb(commands, input.verb, Application.CounterId.make(input.counterId));
    return counterHomeHref({});
  }).pipe(Effect.catch(() => Effect.succeed(counterHomeHref({ error: "command-failed" }))));
