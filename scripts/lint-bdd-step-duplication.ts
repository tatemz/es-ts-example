import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { namedExceptionAllowsPath } from "./policy-exceptions.ts";
import { failPolicy } from "./policy-output.ts";

type StepPair = {
  readonly relativePath: string;
  readonly domainPath: string;
  readonly applicationPath: string;
};

type Violation = {
  readonly path: string;
  readonly message: string;
};

const domainStepsRoot = "packages/domain/test/e2e/steps/";
const applicationStepsRoot = "packages/application/test/e2e/steps/";

const relativeStepPath = (root: string, path: string): string =>
  Fn.pipe(path, Str.replace(root, ""));

const stepFiles = (root: string): ReadonlyArray<string> => [
  ...new Bun.Glob(`${root}**/*.steps.ts`).scanSync("."),
];

const pureReExportPattern = /^\s*export\s+(?:\{[^}]+\}|\*)\s+from\s+["'][^"']+["'];?\s*$/s;

const isPureReExport = async (path: string): Promise<boolean> =>
  pureReExportPattern.test(await Bun.file(path).text());

const applicationPathFor = (relativePath: string): string =>
  `${applicationStepsRoot}${relativePath}`;

const pairs = (): ReadonlyArray<StepPair> => {
  const applicationFiles = stepFiles(applicationStepsRoot);
  return Fn.pipe(
    stepFiles(domainStepsRoot),
    Arr.filter((domainPath) =>
      Fn.pipe(
        applicationFiles,
        Arr.contains(applicationPathFor(relativeStepPath(domainStepsRoot, domainPath))),
      ),
    ),
    Arr.map((domainPath) => {
      const relativePath = relativeStepPath(domainStepsRoot, domainPath);
      return {
        relativePath,
        domainPath,
        applicationPath: applicationPathFor(relativePath),
      };
    }),
  );
};

const violationForPair = async (pair: StepPair): Promise<Option.Option<Violation>> => {
  const domainIsReExport = await isPureReExport(pair.domainPath);
  const applicationIsReExport = await isPureReExport(pair.applicationPath);
  return domainIsReExport || applicationIsReExport
    ? Option.none()
    : Option.some({
        path: pair.applicationPath,
        message: `${pair.relativePath} duplicates domain and application step implementations; share scenario builders or re-export one side.`,
      });
};

const violations = Fn.pipe(
  await Promise.all(Fn.pipe(pairs(), Arr.map(violationForPair))),
  Arr.filter(Option.isSome),
  Arr.map((violation) => violation.value),
  Arr.filter(
    (violation) => !namedExceptionAllowsPath("bdd-step-duplication-ratchet", violation.path),
  ),
);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `BDD step duplication violations:\n${Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message}`),
      Arr.join("\n"),
    )}`,
  );
}
