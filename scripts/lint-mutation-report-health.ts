import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import { failPolicy } from "./policy-output.ts";

type Mutant = {
  readonly status?: unknown;
};

type MutationFile = {
  readonly mutants?: unknown;
};

type MutationReport = {
  readonly files?: Readonly<Record<string, MutationFile>>;
};

type ReportSummary = {
  readonly path: string;
  readonly survived: number;
  readonly noCoverage: number;
  readonly timeout: number;
  readonly errors: number;
};

const reportPaths = (): ReadonlyArray<string> => [
  ...new Bun.Glob("packages/*/reports/mutation/mutation.json").scanSync("."),
];

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

const reportSummary = async (path: string): Promise<ReportSummary> => {
  const report = (await Bun.file(path).json()) as MutationReport;
  const mutants = mutantsFromReport(report);
  return {
    path,
    survived: countStatus(mutants, "Survived"),
    noCoverage: countStatus(mutants, "NoCoverage"),
    timeout: countStatus(mutants, "Timeout"),
    errors: countStatus(mutants, "CompileError") + countStatus(mutants, "RuntimeError"),
  };
};

const healthViolations = (summary: ReportSummary): ReadonlyArray<string> =>
  Fn.pipe(
    [
      summary.survived === 0 ? [] : [`${summary.path}: ${summary.survived} surviving mutants.`],
      summary.noCoverage === 0
        ? []
        : [`${summary.path}: ${summary.noCoverage} no-coverage mutants.`],
    ],
    Arr.flatten,
  );

const summaries = await Promise.all(Fn.pipe(reportPaths(), Arr.map(reportSummary)));
const violations = Fn.pipe(summaries, Arr.flatMap(healthViolations));

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(`Mutation report health violations:\n${Fn.pipe(violations, Arr.join("\n"))}`);
}

if (Arr.isReadonlyArrayEmpty(summaries)) {
  process.stdout.write("No mutation reports found.\n");
} else {
  process.stdout.write(
    `${Fn.pipe(
      summaries,
      Arr.map(
        (summary) =>
          `${summary.path}: survived=${summary.survived}, noCoverage=${summary.noCoverage}, timeout=${summary.timeout}, errors=${summary.errors}`,
      ),
      Arr.join("\n"),
    )}\n`,
  );
}
