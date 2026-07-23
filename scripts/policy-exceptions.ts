import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";

export type PolicyException = {
  readonly name: string;
  readonly rationale: string;
  readonly removalCondition: string;
  readonly ownerScript: string;
  readonly paths: ReadonlyArray<string>;
  readonly patterns: ReadonlyArray<RegExp>;
};

const noPatterns: ReadonlyArray<RegExp> = [];

export const policyExceptions: ReadonlyArray<PolicyException> = Arr.make(
  {
    name: "mutation-runtime-boundaries",
    rationale:
      "Exclude runtime composition and adapter wiring that is exercised end-to-end rather than by unit-level mutation.",
    removalCondition:
      "Delete entries once the adapter has deterministic unit-level mutation tests.",
    ownerScript: "scripts/lint-mutation-scope.ts",
    paths: Arr.make(
      "packages/web/src/identityGenerators.ts",
      "packages/web/src/mvc/jsx-runtime.ts",
      "packages/web/src/rpcClients.ts",
      "packages/web/src/server.ts",
    ),
    patterns: noPatterns,
  },
  {
    name: "mutation-public-barrel-boundaries",
    rationale:
      "Exclude public package barrels from mutation because their behavior is export wiring, and the Bun per-test runner eager-imports mutated barrels before tests execute.",
    removalCondition:
      "Delete once public entrypoint exports are validated by mutation-safe export contract tests or the Bun runner stops eager-importing mutated barrels.",
    ownerScript: "scripts/lint-mutation-scope.ts",
    paths: Arr.make("packages/web/src/index.ts"),
    patterns: noPatterns,
  },
  {
    name: "mutation-web-i18n-adapter-surface",
    rationale:
      "Exclude the FormatJS adapter and singleton catalog wiring from mutation. Focused formatting tests and the catalog policy cover their observable contracts; Stryker can only suppress descriptor-object and message-string mutants at file granularity.",
    removalCondition:
      "Delete once Stryker supports narrow per-line policy-owned excludes or once the i18n adapter is replaced by behaviorful first-party formatting code with mutation-oriented tests.",
    ownerScript: "scripts/lint-mutation-scope.ts",
    paths: Arr.make("packages/web/!src/i18n/**/*.ts"),
    patterns: noPatterns,
  },
  {
    name: "bdd-step-duplication-ratchet",
    rationale:
      "Domain and application currently duplicate BDD step implementations for the counter feature while their execution adapters differ.",
    removalCondition:
      "Delete each entry after shared scenario builders or re-exported steps remove the duplicate implementation.",
    ownerScript: "scripts/lint-bdd-step-duplication.ts",
    paths: Arr.make("packages/application/test/e2e/steps/counter.steps.ts"),
    patterns: noPatterns,
  },
  {
    name: "bdd-support-architecture-ratchet",
    rationale: "Generic BDD assertion modules predate a shared test-support assertion vocabulary.",
    removalCondition:
      "Delete each entry after shared assertions move to @es-ts-example/test-support and local support keeps only layer-specific adapters.",
    ownerScript: "scripts/lint-bdd-support-architecture.ts",
    paths: Arr.make(
      "packages/application/test/e2e/support/Assertions.ts",
      "packages/domain/test/e2e/support/Assertions.ts",
    ),
    patterns: noPatterns,
  },
);

export const policyExceptionNamed = (name: string): PolicyException | undefined =>
  Fn.pipe(
    policyExceptions,
    Arr.findFirst((exception) => exception.name === name),
    Option.getOrUndefined,
  );

export const exceptionAllowsPath = (exception: PolicyException, path: string): boolean =>
  Fn.pipe(
    exception.paths,
    Arr.some((allowedPath) => allowedPath === path),
  ) ||
  Fn.pipe(
    exception.patterns,
    Arr.some((pattern) => pattern.test(path)),
  );

export const namedExceptionAllowsPath = (name: string, path: string): boolean => {
  const exception = policyExceptionNamed(name);
  return exception === undefined ? false : exceptionAllowsPath(exception, path);
};
