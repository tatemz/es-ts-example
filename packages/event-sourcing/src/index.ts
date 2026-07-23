import * as Effect from "effect/Effect";
export * from "./aggregate.ts";
export * from "./decision.ts";
export * from "./event-store.ts";
export * from "./projection.ts";
export * from "./projection-store.ts";
export * from "./repository.ts";

export const main = (): Effect.Effect<void> => Effect.logInfo("event-sourcing ready");
