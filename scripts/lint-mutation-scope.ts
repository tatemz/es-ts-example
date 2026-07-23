import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { namedExceptionAllowsPath } from "./policy-exceptions.ts";
import { trackedFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type Violation = {
  readonly path: string;
  readonly message: string;
};

const sourcePathPattern = /^(packages\/[^/]+)\/src\/.*\.(ts|tsx)$/;
const packageDirectoryPattern = /^(packages\/[^/]+)\/src\//;

const packageDirectoryOf = (path: string): string | undefined =>
  packageDirectoryPattern.exec(path) === null
    ? undefined
    : Fn.pipe(packageDirectoryPattern.exec(path) ?? [], Arr.get(1), Option.getOrUndefined);

const uniquePackageDirectories = (): ReadonlyArray<string> =>
  Fn.pipe(
    trackedFiles(),
    Arr.filter((path) => sourcePathPattern.test(path)),
    Arr.map(packageDirectoryOf),
    Arr.filter((path): path is string => path !== undefined),
    Arr.dedupe,
  );

const packageHasTsx = (directory: string): boolean =>
  Fn.pipe(
    trackedFiles(),
    Arr.some(
      (path) =>
        sourcePathPattern.test(path) &&
        packageDirectoryOf(path) === directory &&
        Fn.pipe(path, Str.endsWith(".tsx")),
    ),
  );

const webI18nMutationExcludes = Arr.make("!src/i18n/**/*.ts");

const web2ThrowawayUiMutationExcludes = Arr.make(
  "!src/ui/**/*.ts",
  "!src/ui/**/*.tsx",
  "!src/discover/**/*.ts",
  "!src/discover/**/*.tsx",
  "!src/search/**/*.ts",
  "!src/search/**/*.tsx",
  "!src/route/**/*.ts",
  "!src/route/**/*.tsx",
  "!src/play/**/*.ts",
  "!src/play/**/*.tsx",
  "!src/party/**/*.ts",
  "!src/party/**/*.tsx",
  "!src/memory/**/*.ts",
  "!src/memory/**/*.tsx",
  "!src/reward/**/*.ts",
  "!src/reward/**/*.tsx",
  "!src/profile/**/*.ts",
  "!src/profile/**/*.tsx",
  "!src/create/**/*.ts",
  "!src/create/**/*.tsx",
  "!src/mvc/**/*.ts",
);

const webI18nMutationEntryAllowed = (directory: string, entry: string): boolean =>
  Fn.pipe(webI18nMutationExcludes, Arr.contains(entry))
    ? namedExceptionAllowsPath("mutation-web-i18n-adapter-surface", `${directory}/${entry}`)
    : false;

const web2ThrowawayUiMutationEntryAllowed = (directory: string, entry: string): boolean =>
  directory === "packages/web2" && Fn.pipe(web2ThrowawayUiMutationExcludes, Arr.contains(entry))
    ? namedExceptionAllowsPath("mutation-web2-throwaway-ui", `${directory}/${entry}`)
    : false;

const fixedMutationExceptionScopes = new Map([
  ["!src/postgres-event-store.ts", "mutation-runtime-boundaries"],
  ["!src/identityGenerators.ts", "mutation-runtime-boundaries"],
  ["!src/mvc/jsx-runtime.ts", "mutation-runtime-boundaries"],
  ["!src/rpcClients.ts", "mutation-runtime-boundaries"],
  ["!src/server.ts", "mutation-runtime-boundaries"],
  ["!src/client.ts", "mutation-runtime-boundaries"],
  ["!src/payments/commands/beginAdventureTip.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/commands/reconcileAdventureTipPayment.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/paymentProvider.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/processedProviderEvents.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/Commands.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/FailureReasons.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/payments/Invariants.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/paymentRoutePolicy.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/runtime-config.ts", "mutation-sandbox-payment-boundaries"],
  ["!src/demo.ts", "mutation-static-seed-identifiers"],
  ["!src/index.ts", "mutation-public-barrel-boundaries"],
]);

const fixedMutationEntryAllowed = (directory: string, entry: string): boolean =>
  fixedMutationExceptionScopes.get(entry) === undefined
    ? false
    : namedExceptionAllowsPath(
        fixedMutationExceptionScopes.get(entry) ?? "",
        `${directory}/${Fn.pipe(entry, Str.replace(/^!/, ""))}`,
      );

const mutationEntryAllowed = (directory: string, entry: string): boolean => {
  if (!Fn.pipe(entry, Str.startsWith("!"))) {
    return true;
  }

  return (
    fixedMutationEntryAllowed(directory, entry) ||
    webI18nMutationEntryAllowed(directory, entry) ||
    web2ThrowawayUiMutationEntryAllowed(directory, entry)
  );
};

const missingBroadMutationViolation = (
  condition: boolean,
  path: string,
  message: string,
): ReadonlyArray<Violation> => (condition ? [] : [{ path, message }]);

const mutationViolations = async (directory: string): Promise<ReadonlyArray<Violation>> => {
  const path = `${directory}/stryker.config.json`;
  const config = await Bun.file(path).json();
  const mutate: ReadonlyArray<string> = config.mutate ?? [];
  const hasTs = Fn.pipe(
    mutate,
    Arr.some((entry) => entry === "src/**/*.ts"),
  );
  const hasTsx = Fn.pipe(
    mutate,
    Arr.some((entry) => entry === "src/**/*.tsx"),
  );
  const broadViolations = [
    ...missingBroadMutationViolation(
      hasTs,
      path,
      "mutate must include src/**/*.ts instead of a hand-picked file list.",
    ),
    ...missingBroadMutationViolation(
      !packageHasTsx(directory) || hasTsx,
      path,
      "mutate must include src/**/*.tsx because this package has TSX source.",
    ),
  ];
  const badExcludes = Fn.pipe(
    mutate,
    Arr.filter((entry) => !mutationEntryAllowed(directory, entry)),
    Arr.map((entry) => ({
      path,
      message: `mutation exclude ${entry} is not a named policy exception.`,
    })),
  );

  return [...broadViolations, ...badExcludes];
};

const checked = await Promise.all(Fn.pipe(uniquePackageDirectories(), Arr.map(mutationViolations)));
const violations = Fn.pipe(checked, Arr.flatten);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message}`),
      Arr.join("\n"),
    ),
  );
}
