import * as Arr from "effect/Array";
import * as Fn from "effect/Function";

type PackageManifest = {
  readonly name?: string;
};

type PackageMutationResult = {
  readonly name: string;
  readonly elapsedMs: number;
  readonly exitCode: number;
};

type TimingSummary = {
  readonly packages: Readonly<Record<string, { readonly elapsedMs: number }>>;
};

const defaultPackageConcurrency = 1;

const positiveInteger = (value: string | undefined, fallback: number): number =>
  value === undefined || !/^[1-9]\d*$/.test(value) ? fallback : Number(value);

const optionalPositiveInteger = (value: string | undefined): number | undefined =>
  value === undefined || !/^[1-9]\d*$/.test(value) ? undefined : Number(value);

const mutationScript = process.env.MUTATION_PACKAGE_SCRIPT ?? "mutation";
const packageConcurrency = positiveInteger(
  process.env.MUTATION_PACKAGE_CONCURRENCY,
  defaultPackageConcurrency,
);
const strykerConcurrency = optionalPositiveInteger(process.env.MUTATION_STRYKER_CONCURRENCY);

// ponytail: forward a per-package mutation worker cap so package concurrency and
// tool worker concurrency multiply to a bounded total instead of
// oversubscribing every core. Upgrade path: compute from os.cpus() if a single
// env knob proves too blunt.
const strykerArgs: ReadonlyArray<string> =
  strykerConcurrency === undefined ? [] : ["--", "--concurrency", String(strykerConcurrency)];

const packageManifestPaths = (): ReadonlyArray<string> => [
  ...new Bun.Glob("packages/*/package.json").scanSync("."),
];

const packageName = async (manifestPath: string): Promise<string> => {
  const manifest = (await Bun.file(manifestPath).json()) as PackageManifest;
  return typeof manifest.name === "string" ? manifest.name : manifestPath;
};

const formatDuration = (elapsedMs: number): string => `${(elapsedMs / 1000).toFixed(1)}s`;

const resultLabel = (result: PackageMutationResult): string =>
  result.exitCode === 0 ? "passed" : `failed (${result.exitCode})`;

const timingLine = (result: PackageMutationResult): string =>
  `${result.name}: ${resultLabel(result)} in ${formatDuration(result.elapsedMs)}`;

const runPackageMutation = async (manifestPath: string): Promise<PackageMutationResult> => {
  const name = await packageName(manifestPath);
  const startedAt = performance.now();
  process.stdout.write(`\n==> ${name}\n`);
  const command = Bun.spawn({
    cmd: ["bun", "--filter", name, mutationScript, ...strykerArgs],
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await command.exited;
  const elapsedMs = performance.now() - startedAt;
  process.stdout.write(`<== ${name}: ${resultLabel({ name, elapsedMs, exitCode })}\n`);
  return { name, elapsedMs, exitCode };
};

const runBatches = async (
  manifestPaths: ReadonlyArray<string>,
): Promise<ReadonlyArray<PackageMutationResult>> => {
  if (Arr.isReadonlyArrayEmpty(manifestPaths)) {
    return [];
  }

  const batch = manifestPaths.slice(0, packageConcurrency);
  const rest = manifestPaths.slice(packageConcurrency);
  return [...(await Promise.all(batch.map(runPackageMutation))), ...(await runBatches(rest))];
};

const summaryLines = (
  results: ReadonlyArray<PackageMutationResult>,
  wallElapsedMs: number,
): ReadonlyArray<string> => [
  "",
  `Mutation timing (${mutationScript}, package concurrency ${packageConcurrency}):`,
  ...Fn.pipe(results, Arr.map(timingLine)),
  `wall: ${formatDuration(wallElapsedMs)}`,
];

const timingSummary = (results: ReadonlyArray<PackageMutationResult>): TimingSummary => ({
  packages: Fn.pipe(
    results,
    Arr.reduce({}, (summary: Record<string, { readonly elapsedMs: number }>, result) => ({
      ...summary,
      [result.name]: { elapsedMs: result.elapsedMs },
    })),
  ),
});

const runPolicyScript = async (scriptName: string): Promise<number> =>
  await Bun.spawn({
    cmd: ["bun", "run", scriptName],
    stdout: "inherit",
    stderr: "inherit",
  }).exited;

const hasPackageFailure = (results: ReadonlyArray<PackageMutationResult>): boolean =>
  !Arr.isReadonlyArrayEmpty(
    Fn.pipe(
      results,
      Arr.filter((result) => result.exitCode !== 0),
    ),
  );

const runPostMutationPolicy = async (): Promise<ReadonlyArray<number>> =>
  await Promise.all(
    Arr.map(Arr.make("lint:mutation-report-health", "lint:mutation-baselines"), runPolicyScript),
  );

const startedAt = performance.now();
const results = await runBatches(packageManifestPaths());
const wallElapsedMs = performance.now() - startedAt;
await Bun.write(".mutation-timing.json", `${JSON.stringify(timingSummary(results), null, 2)}\n`);
process.stdout.write(`${Fn.pipe(summaryLines(results, wallElapsedMs), Arr.join("\n"))}\n`);

if (hasPackageFailure(results)) {
  process.exit(1);
}

if (
  !Arr.isReadonlyArrayEmpty(
    Fn.pipe(
      await runPostMutationPolicy(),
      Arr.filter((code) => code !== 0),
    ),
  )
) {
  process.exit(1);
}
