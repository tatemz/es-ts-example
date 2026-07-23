import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import type { Codec, SchemaError } from "effect/Schema";
import type * as Persistence from "effect/unstable/persistence";
import { type ProjectionEnvelope, initialEnvelope } from "./projection.ts";

export type Versioned<A> = {
  readonly value: A;
  readonly version: number;
};

export class ProjectionStoreVersionConflict {
  readonly _tag = "ProjectionStoreVersionConflict";

  constructor(
    readonly options: {
      readonly projectionId: string;
      readonly expectedVersion: number;
      readonly actualVersion: number;
    },
  ) {}

  get projectionId(): string {
    return this.options.projectionId;
  }

  get expectedVersion(): number {
    return this.options.expectedVersion;
  }

  get actualVersion(): number {
    return this.options.actualVersion;
  }
}

export type ProjectionStoreError =
  | ProjectionStoreVersionConflict
  | Persistence.KeyValueStore.KeyValueStoreError
  | SchemaError;

/**
 * Storage facade for projection envelopes. Wraps a `KeyValueStore` and
 * absent-value handling so callers always get back a populated envelope
 * (initial state at version 0 when the projection has never been written).
 *
 * `version` is owned by this store wrapper: callers pass back the version they
 * last received as `expectedVersion` on `save`.
 */
export type ProjectionStore<State> = {
  readonly load: (
    projectionId: string,
  ) => Effect.Effect<Versioned<ProjectionEnvelope<State>>, ProjectionStoreError>;
  readonly save: (
    projectionId: string,
    envelope: ProjectionEnvelope<State>,
    expectedVersion: number,
  ) => Effect.Effect<Versioned<ProjectionEnvelope<State>>, ProjectionStoreError>;
};

export const makeProjectionStore = <
  State,
  StoreSchema extends Codec<Versioned<ProjectionEnvelope<State>>>,
>(options: {
  readonly schemaStore: Persistence.KeyValueStore.SchemaStore<StoreSchema>;
  readonly initialState: State;
}): ProjectionStore<State> => {
  const initialVersionedEnvelope: Versioned<ProjectionEnvelope<State>> = {
    value: initialEnvelope(options.initialState),
    version: 0,
  };

  return {
    load: (projectionId) =>
      Fn.pipe(
        options.schemaStore.get(projectionId),
        Effect.map(
          Option.match({
            onNone: () => initialVersionedEnvelope,
            onSome: (envelope) => envelope,
          }),
        ),
      ),
    save: (projectionId, envelope, expectedVersion) =>
      Effect.gen(function* () {
        const storedProjection = yield* options.schemaStore.get(projectionId);
        const actualVersion = Fn.pipe(
          storedProjection,
          Option.match({
            onNone: () => 0,
            onSome: (stored) => stored.version,
          }),
        );

        if (actualVersion !== expectedVersion) {
          return yield* Effect.fail(
            new ProjectionStoreVersionConflict({
              projectionId,
              expectedVersion,
              actualVersion,
            }),
          );
        }

        const savedProjection = {
          value: envelope,
          version: actualVersion + 1,
        };
        yield* options.schemaStore.set(projectionId, savedProjection);

        return savedProjection;
      }),
  };
};
