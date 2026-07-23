import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

type Baseline = {
  readonly wallTimeMs: number;
  readonly mutantCount: number;
  readonly timeouts: number;
  readonly errors: number;
  readonly survived: number;
  readonly noCoverage: number;
};

type BaselineFile = {
  readonly packages?: Readonly<Record<string, Baseline>>;
};

type TimingFile = {
  readonly packages?: Readonly<Record<string, { readonly elapsedMs?: unknown }>>;
};

type Mutant = {
  readonly status?: unknown;
};

type MutationFile = {
  readonly mutants?: unknown;
};

type MutationReport = {
  readonly files?: Readonly<Record<string, MutationFile>>;
};

type Current = {
  readonly packageName: string;
  readonly mutantCount: number;
  readonly timeouts: number;
  readonly errors: number;
  readonly survived: number;
  readonly noCoverage: number;
  readonly wallTimeMs?: number;
};

const baselinePath = "policy/mutation-baselines.json";
const timingPath = ".mutation-timing.json";
const strictBaseline = process.env.MUTATION_BASELINE_STRICT === "1";

const packageNameForReport = async (reportPath: string): Promise<string> => {
  const directory = Fn.pipe(reportPath, Str.replace(/\/reports\/mutation\/mutation\.json$/, ""));
  const manifest = (await Bun.file(`${directory}/package.json`).json()) as {
    readonly name?: string;
  };
  return manifest.name ?? directory;
};

const mutantsFromReport = (report: MutationReport): ReadonlyArray<Mutant> =>
  Fn.pipe(
    report.files ?? {},
    Rec.values,
    Arr.flatMap((file) => (Arr.isArray(file.mutants) ? file.mutants : [])),
    Arr.filter((mutant): mutant is Mutant => typeof mutant === "object" && mutant !== null),
  );

const countStatus = (mutants: ReadonlyArray<Mutant>, status: string): number =>
  Fn.pipe(
    mutants,
    Arr.filter((mutant) => mutant.status === status),
    Arr.length,
  );

const timingFor = (timing: TimingFile, packageName: string): Option.Option<number> => {
  const value = timing.packages?.[packageName]?.elapsedMs;
  return typeof value === "number" ? Option.some(value) : Option.none();
};

const currentForReport = async (reportPath: string, timing: TimingFile): Promise<Current> => {
  const report = (await Bun.file(reportPath).json()) as MutationReport;
  const mutants = mutantsFromReport(report);
  const packageName = await packageNameForReport(reportPath);
  return {
    packageName,
    mutantCount: Arr.length(mutants),
    timeouts: countStatus(mutants, "Timeout"),
    errors: countStatus(mutants, "CompileError") + countStatus(mutants, "RuntimeError"),
    survived: countStatus(mutants, "Survived"),
    noCoverage: countStatus(mutants, "NoCoverage"),
    wallTimeMs: Option.getOrUndefined(timingFor(timing, packageName)),
  };
};

const reportPaths = (): ReadonlyArray<string> => [
  ...new Bun.Glob("packages/*/reports/mutation/mutation.json").scanSync("."),
];

const optionalJson = async <A>(path: string, fallback: A): Promise<A> =>
  (await Bun.file(path).exists()) ? ((await Bun.file(path).json()) as A) : fallback;

const tooHigh = (current: number, baseline: number, multiplier: number): boolean =>
  current > baseline * multiplier;

const minimumWallTimeRegressionMs = 30_000;

const violationIf = (condition: boolean, message: string): ReadonlyArray<string> =>
  condition ? [message] : [];

const strictBaselineViolations = (
  violations: ReadonlyArray<string>,
  timingRegressions: ReadonlyArray<string>,
): ReadonlyArray<string> => (strictBaseline ? [...violations, ...timingRegressions] : violations);

const mutantCountViolation = (baseline: Baseline, current: Current): ReadonlyArray<string> =>
  violationIf(
    tooHigh(current.mutantCount, baseline.mutantCount, 1.15),
    `${current.packageName}: mutant count ${current.mutantCount} exceeds baseline ${baseline.mutantCount} by more than 15%.`,
  );

const isWallTimeRegression = (baseline: Baseline, current: Current): boolean =>
  current.wallTimeMs !== undefined &&
  tooHigh(current.wallTimeMs, baseline.wallTimeMs, 1.2) &&
  current.wallTimeMs - baseline.wallTimeMs > minimumWallTimeRegressionMs;

const wallTimeViolation = (baseline: Baseline, current: Current): ReadonlyArray<string> =>
  violationIf(
    isWallTimeRegression(baseline, current),
    `${current.packageName}: mutation time ${current.wallTimeMs}ms exceeds baseline ${baseline.wallTimeMs}ms by more than 20% and more than ${minimumWallTimeRegressionMs}ms.`,
  );

const countIncreaseViolation = (input: {
  readonly packageName: string;
  readonly label: string;
  readonly baseline: number;
  readonly current: number;
}): ReadonlyArray<string> =>
  violationIf(
    input.current > input.baseline,
    `${input.packageName}: ${input.label} increased from ${input.baseline} to ${input.current}.`,
  );

const currentViolations = (baseline: Baseline, current: Current): ReadonlyArray<string> =>
  Fn.pipe(
    [
      mutantCountViolation(baseline, current),
      countIncreaseViolation({
        packageName: current.packageName,
        label: "error mutants",
        baseline: baseline.errors,
        current: current.errors,
      }),
      countIncreaseViolation({
        packageName: current.packageName,
        label: "surviving mutants",
        baseline: baseline.survived,
        current: current.survived,
      }),
      countIncreaseViolation({
        packageName: current.packageName,
        label: "no-coverage mutants",
        baseline: baseline.noCoverage,
        current: current.noCoverage,
      }),
    ],
    Arr.flatten,
  );

const timingWarnings = (baseline: Baseline, current: Current): ReadonlyArray<string> =>
  Fn.pipe(
    [
      wallTimeViolation(baseline, current),
      countIncreaseViolation({
        packageName: current.packageName,
        label: "timeout mutants",
        baseline: baseline.timeouts,
        current: current.timeouts,
      }),
    ],
    Arr.flatten,
  );

const baselineFile = await optionalJson<BaselineFile>(baselinePath, { packages: {} });
const timingFile = await optionalJson<TimingFile>(timingPath, { packages: {} });
const current = await Promise.all(
  Fn.pipe(
    reportPaths(),
    Arr.map((path) => currentForReport(path, timingFile)),
  ),
);
const violations = Fn.pipe(
  current,
  Arr.flatMap((item) => {
    const baseline = baselineFile.packages?.[item.packageName];
    return baseline === undefined
      ? [`${item.packageName}: missing mutation baseline in ${baselinePath}.`]
      : currentViolations(baseline, item);
  }),
);
const timingRegressions = Fn.pipe(
  current,
  Arr.flatMap((item) => {
    const baseline = baselineFile.packages?.[item.packageName];
    return baseline === undefined ? [] : timingWarnings(baseline, item);
  }),
);
const blockingViolations = strictBaselineViolations(violations, timingRegressions);

if (!Arr.isReadonlyArrayEmpty(blockingViolations)) {
  failPolicy(`Mutation baseline violations:\n${Fn.pipe(blockingViolations, Arr.join("\n"))}`);
}

process.stdout.write(
  Arr.isReadonlyArrayEmpty(current)
    ? "No mutation reports found.\n"
    : `${Fn.pipe(
        current,
        Arr.map((item) => `${item.packageName}: mutants=${item.mutantCount}`),
        Arr.join("\n"),
      )}\n`,
);

if (!Arr.isReadonlyArrayEmpty(timingRegressions)) {
  process.stdout.write(
    `Mutation timing warnings${strictBaseline ? " (strict)" : " (report-only)"}:\n${Fn.pipe(
      timingRegressions,
      Arr.join("\n"),
    )}\n`,
  );
}
