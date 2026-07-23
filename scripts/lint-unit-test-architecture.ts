import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { namedExceptionAllowsPath } from "./policy-exceptions.ts";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type PackagePolicy = {
  readonly directory: string;
  readonly enforceSlices: boolean;
  readonly slices: ReadonlyArray<string>;
};

type Violation = {
  readonly path: string;
  readonly message: string;
};

const packagePolicies: ReadonlyArray<PackagePolicy> = [
  {
    directory: "packages/application",
    enforceSlices: true,
    slices: Arr.make("counter", "index"),
  },
  {
    directory: "packages/domain",
    enforceSlices: true,
    slices: Arr.make("counter", "index"),
  },
  {
    directory: "packages/cli",
    enforceSlices: true,
    slices: Arr.make("cli"),
  },
  {
    directory: "packages/web",
    enforceSlices: true,
    slices: Arr.make("counter", "html", "i18n", "index", "web-infrastructure"),
  },
];

const unitTestPattern = /^packages\/[^/]+\/test\/unit\/.*\.test\.tsx?$/;
const packageDirectoryPattern = /^(packages\/[^/]+)\//;

const packageDirectory = (path: string): string => packageDirectoryPattern.exec(path)?.[1] ?? "";

const slicePath = (policy: PackagePolicy, slice: string): string =>
  `${policy.directory}/test/unit/${slice}`;

const sliceMissingAllowedByRatchet = (policy: PackagePolicy, slice: string): boolean =>
  namedExceptionAllowsPath("unit-test-slice-ratchet", slicePath(policy, slice));

const missingSliceViolations = (
  policy: PackagePolicy,
  files: ReadonlyArray<string>,
): ReadonlyArray<Violation> =>
  policy.enforceSlices
    ? Fn.pipe(
        policy.slices,
        Arr.filter(
          (slice) =>
            !Fn.pipe(
              files,
              Arr.some(
                (path) =>
                  path === `${policy.directory}/test/unit/${slice}.test.ts` ||
                  path === `${policy.directory}/test/unit/${slice}.test.tsx` ||
                  Fn.pipe(path, Str.startsWith(`${policy.directory}/test/unit/${slice}/`)),
              ),
            ) && !sliceMissingAllowedByRatchet(policy, slice),
        ),
        Arr.map((slice) => ({
          path: `${policy.directory}/test/unit`,
          message: `missing required unit test slice ${slice}.`,
        })),
      )
    : [];

const unitTestFiles = Fn.pipe(
  trackedTextFiles(),
  Arr.filter((path) => unitTestPattern.test(path)),
);
const packageFiles = Fn.pipe(
  unitTestFiles,
  Arr.reduce({} as Readonly<Record<string, ReadonlyArray<string>>>, (byPackage, path) => ({
    ...byPackage,
    [packageDirectory(path)]: [...(byPackage[packageDirectory(path)] ?? []), path],
  })),
);
const violations = Fn.pipe(
  packagePolicies,
  Arr.flatMap((policy) => missingSliceViolations(policy, packageFiles[policy.directory] ?? [])),
);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `Unit test architecture violations:\n${Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message}`),
      Arr.join("\n"),
    )}`,
  );
}
