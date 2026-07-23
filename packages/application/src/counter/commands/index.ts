import * as Schema from "effect/Schema";
import { CreateCounterCommand } from "./createCounter.ts";
import { DecrementCounterCommand } from "./decrementCounter.ts";
import { DisableCounterCommand } from "./disableCounter.ts";
import { IncrementCounterCommand } from "./incrementCounter.ts";

export * from "./commandMetadata.ts";
export * from "./createCounter.ts";
export * from "./decrementCounter.ts";
export * from "./disableCounter.ts";
export * from "./incrementCounter.ts";
export * from "./makeCounterHandler.ts";

export const CounterCommand = Schema.Union([
  CreateCounterCommand,
  IncrementCounterCommand,
  DecrementCounterCommand,
  DisableCounterCommand,
]);
export type CounterCommand = typeof CounterCommand.Type;
