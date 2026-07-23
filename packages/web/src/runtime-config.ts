import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";

const storageBackends = ["memory", "json-file"] as const;
export type StorageBackend = (typeof storageBackends)[number];

const storageBackendList = Fn.pipe(storageBackends, Arr.join(", "));

export type WebRuntimeStorageConfig = {
  readonly storageBackend: StorageBackend;
  readonly eventStoreFile: string;
};

const isStorageBackend = (value: string): value is StorageBackend =>
  value === "memory" || value === "json-file";

export const parseStorageBackend = (value: string): Effect.Effect<StorageBackend, Error> =>
  isStorageBackend(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new Error(
          `Unsupported STORAGE_BACKEND "${value}". Expected one of: ${storageBackendList}.`,
        ),
      );
