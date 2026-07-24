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

const webI18nMutationEntryAllowed = (directory: string, entry: string): boolean =>
  Fn.pipe(webI18nMutationExcludes, Arr.contains(entry))
    ? namedExceptionAllowsPath("mutation-web-i18n-adapter-surface", `${directory}/${entry}`)
    : false;

const fixedMutationExceptionScopes = new Map([
  ["!src/mvc/jsx-runtime.ts", "mutation-runtime-boundaries"],
  ["!src/server.ts", "mutation-runtime-boundaries"],
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
    fixedMutationEntryAllowed(directory, entry) || webI18nMutationEntryAllowed(directory, entry)
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
