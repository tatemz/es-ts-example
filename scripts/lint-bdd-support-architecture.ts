import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { namedExceptionAllowsPath } from "./policy-exceptions.ts";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

const genericBddAssertionsPattern =
  /^(?:packages\/(?:application|domain)\/test\/e2e\/support\/Assertions\.ts|test\/effect-bdd\/support\/Assertions\.ts)$/;

const violations = Fn.pipe(
  trackedTextFiles(),
  Arr.filter((path) => genericBddAssertionsPattern.test(path)),
  Arr.filter((path) => !namedExceptionAllowsPath("bdd-support-architecture-ratchet", path)),
  Arr.map((path) => ({
    path,
    message:
      "generic BDD assertions belong in @es-ts-example/test-support; keep only layer-specific adapters in package e2e support.",
  })),
);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `BDD support architecture violations:\n${Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message}`),
      Arr.join("\n"),
    )}`,
  );
}
