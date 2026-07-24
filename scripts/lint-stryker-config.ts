import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { trackedFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type StrykerConfig = {
  readonly coverageAnalysis?: unknown;
  readonly mutate?: unknown;
  readonly reporters?: unknown;
  readonly thresholds?: Readonly<Record<string, unknown>>;
  readonly bun?: { readonly testFiles?: unknown };
};

type Violation = {
  readonly path: string;
  readonly message: string;
};

const packageDirectories = Fn.pipe(
  [...new Bun.Glob("packages/*/package.json").scanSync(".")],
  Arr.map((path) => Str.replace(/\/package\.json$/, "")(path)),
  Arr.filter((path) =>
    Fn.pipe(
      trackedFiles(),
      Arr.some((file) => Fn.pipe(file, Str.startsWith(`${path}/src/`))),
    ),
  ),
);

const stringsOnly = (value: unknown): ReadonlyArray<string> =>
  Arr.isArray(value)
    ? Fn.pipe(
        value,
        Arr.filter((item): item is string => typeof item === "string"),
      )
    : [];

const normalizedTestFile = (path: string): string =>
  `./${Fn.pipe(path, Str.replace(/^[^/]+\/[^/]+\//, ""))}`;

const discoveredUnitTestFiles = (directory: string): ReadonlyArray<string> =>
  Fn.pipe(
    trackedFiles(),
    Arr.filter((path) => Fn.pipe(path, Str.startsWith(`${directory}/test/unit/`))),
    Arr.filter((path) => /\.(?:test\.ts|test\.tsx)$/.test(path)),
    Arr.filter((path) => !Fn.pipe(path, Str.includes("/support/"))),
    Arr.map(normalizedTestFile),
    Arr.sort(Order.String),
  );

const setDifference = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  Fn.pipe(
    left,
    Arr.filter((item) => !Fn.pipe(right, Arr.contains(item))),
  );

const sourceMatchesExclude = (directory: string, exclude: string): boolean => {
  const pattern = Fn.pipe(exclude, Str.replace(/^!/, ""));
  if (!/[*?[\]{}]/.test(pattern)) {
    return Fn.pipe(trackedFiles(), Arr.contains(`${directory}/${pattern}`));
  }
  const matches = [...new Bun.Glob(pattern).scanSync(directory)];
  return !Arr.isReadonlyArrayEmpty(matches);
};

const strykerViolations = async (directory: string): Promise<ReadonlyArray<Violation>> => {
  const path = `${directory}/stryker.config.json`;
  const config = (await Bun.file(path).json()) as StrykerConfig;
  const testFiles = Fn.pipe(stringsOnly(config.bun?.testFiles), Arr.sort(Order.String));
  const discovered = discoveredUnitTestFiles(directory);
  const missing = setDifference(discovered, testFiles);
  const stale = setDifference(testFiles, discovered);
  const mutate = stringsOnly(config.mutate);
  const reporters = stringsOnly(config.reporters);
  const badThresholds = Fn.pipe(
    Arr.make("high", "low", "break"),
    Arr.filter((name) => config.thresholds?.[name] !== 100),
    Arr.map((name) => ({ path, message: `thresholds.${name} must be 100.` })),
  );
  const staleExcludes = Fn.pipe(
    mutate,
    Arr.filter((entry) => Fn.pipe(entry, Str.startsWith("!"))),
    Arr.filter((entry) => !sourceMatchesExclude(directory, entry)),
    Arr.map((entry) => ({
      path,
      message: `mutation exclude ${entry} does not match any source file.`,
    })),
  );

  return [
    ...(config.coverageAnalysis === "perTest"
      ? []
      : [{ path, message: 'coverageAnalysis must be "perTest".' }]),
    ...badThresholds,
    ...(Fn.pipe(reporters, Arr.contains("json"))
      ? []
      : [{ path, message: 'reporters must include "json" for report-health checks.' }]),
    ...Fn.pipe(
      missing,
      Arr.map((entry) => ({ path, message: `bun.testFiles is missing ${entry}.` })),
    ),
    ...Fn.pipe(
      stale,
      Arr.map((entry) => ({ path, message: `bun.testFiles references missing ${entry}.` })),
    ),
    ...staleExcludes,
  ];
};

const checked = await Promise.all(Fn.pipe(packageDirectories, Arr.map(strykerViolations)));
const violations = Fn.pipe(checked, Arr.flatten);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `Stryker config violations:\n${Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message}`),
      Arr.join("\n"),
    )}`,
  );
}
