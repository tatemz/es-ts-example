import * as Effect from "effect/Effect";

export * from "./counter/index.ts";
export * from "./identifiers.ts";
export * from "./rpc/inProcess.ts";
export * from "./services.ts";
export * from "./user/index.ts";

export const main = (): Effect.Effect<void> => Effect.logInfo("application ready");
