import { test } from "bun:test";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as Ref from "effect/Ref";

export const runTestEffect = async <F extends () => Effect.Effect<unknown, unknown, never>>(
  fn: F,
): Promise<void> => {
  await Effect.runPromise(fn() as Effect.Effect<unknown, unknown, never>);
};

export const testEffect = <F extends () => Effect.Effect<unknown, unknown, never>>(
  name: string,
  fn: F,
  timeout?: number,
): void => {
  test(name, async () => await runTestEffect(fn), timeout);
};

export const captureLogs = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<ReadonlyArray<string>, E, R> =>
  Effect.gen(function* () {
    const logs = yield* Ref.make<ReadonlyArray<string>>([]);

    yield* effect.pipe(
      Effect.provide(
        Logger.layer([
          Logger.make((options) =>
            Effect.runSync(Ref.update(logs, Arr.append(String(options.message)))),
          ),
        ]),
      ),
    );

    return yield* Ref.get(logs);
  });
