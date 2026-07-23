import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";

export const runEffectMain = <E>(main: Effect.Effect<void, E, never>): void => {
  const program = main.pipe(Effect.provide(BunServices.layer));

  BunRuntime.runMain(program);
};
