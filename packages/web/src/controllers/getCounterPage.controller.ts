import * as Effect from "effect/Effect";
import { makeCounterPageModel } from "../factories/CounterPage.factory.ts";
import type { CounterPageModel } from "../models/CounterPage.model.ts";
import { QueryRpcClient } from "../rpcClients.ts";

export type GetCounterPageInput = {
  readonly error?: string;
  readonly newCounterId?: string;
};

const asPageError = (value: string | undefined): "missing-id" | "command-failed" | undefined => {
  if (value === "missing-id") {
    return "missing-id";
  }
  if (value === "command-failed") {
    return "command-failed";
  }
  return undefined;
};

export const getCounterPageController = (
  input: GetCounterPageInput,
): Effect.Effect<CounterPageModel, unknown, QueryRpcClient> =>
  Effect.gen(function* () {
    const queries = yield* QueryRpcClient;
    const list = yield* queries.ListCounters({});
    return makeCounterPageModel({
      counters: list.counters,
      error: asPageError(input.error),
      newCounterId: input.newCounterId,
    });
  });
