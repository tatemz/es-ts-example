import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

const packageDirectories = Fn.pipe(
  [...new Bun.Glob("packages/*/src").scanSync(".")],
  Arr.map((path) => Str.replace(/\/src$/, "")(path)),
);

const allowedIgnoreValues = [
  "bin/main.ts",
  "bin/runtime.ts",
  "src/server.ts",
  "**/bin/runtime.ts",
  "**/src/server.ts",
] as const;
const allowedIgnorePatterns = [
  /^bin\/[A-Za-z0-9]+Seed\.ts$/,
  /^\*\*\/bin\/[A-Za-z0-9]+Seed\.ts$/,
  /^\.\.\/[a-z0-9-]+\/\*\*$/,
] as const;

const allowedIgnore = (value: string): boolean =>
  Arr.contains(allowedIgnoreValues, value) ||
  Fn.pipe(
    allowedIgnorePatterns,
    Arr.some((pattern) => pattern.test(value)),
  );

const thresholdIs100 = (value: string): boolean =>
  value === "1.0" ||
  value === "{ lines = 1.0, functions = 1.0, statements = 1.0 }" ||
  value === "{ lines = 1.0, statements = 1.0 }";

const stringsOnly = (values: unknown): ReadonlyArray<string> =>
  Arr.isArray(values)
    ? Fn.pipe(
        values,
        Arr.filter((value): value is string => typeof value === "string"),
      )
    : [];

const fileExists = async (path: string): Promise<boolean> => await Bun.file(path).exists();
const readJson = async <A>(path: string): Promise<A> => await Bun.file(path).json();
const readText = async (path: string): Promise<string> => await Bun.file(path).text();

const missingRecordKey = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  Option.isNone(Fn.pipe(record, Rec.get(key)));

const compactOptions = <A>(values: ReadonlyArray<Option.Option<A>>): ReadonlyArray<A> =>
  Fn.pipe(
    values,
    Arr.flatMap((value) => Option.match(value, { onNone: () => [], onSome: (item) => [item] })),
  );

const commonScriptNames = [
  "build",
  "build:types",
  "check",
  "typecheck",
  "format",
  "format:check",
  "format:write",
  "lint",
  "lint:oxlint",
  "lint:types",
  "test",
  "test:coverage",
  "test:property",
  "test:unit",
  "e2e",
  "acceptance",
  "mutation",
  "precommit",
] as const;

const rootPolicyScriptNames = [
  "build:tools",
  "lint:policy",
  "lint:mutation-scope",
  "lint:stryker-config",
  "lint:unit-test-architecture",
  "lint:mutation-report-health",
  "lint:mutation-baselines",
  "lint:noop-scripts",
  "lint:repo-path-policy",
  "lint:suppression-policy",
  "lint:web-ui-components",
] as const;

const exactScriptDirectories: Readonly<Record<string, string>> = {
  "bun test ./test/property": "test/property",
  "bun test --coverage ./test/unit": "test/unit",
  "bun test --no-coverage ./test/e2e": "test/e2e",
};

const effectBddE2eScript =
  /^bunx --bun effect-bdd --features "test\/e2e\/\*\*\/\*\.feature" --steps "test\/e2e\/\*\*\/\*\.steps\.ts" --reporter text$/;

const isE2eStepsScript = (script: string): boolean =>
  script === "bun test ./test/e2e/**/*.steps.ts" ||
  script === "bun test --no-coverage ./test/e2e/**/*.steps.ts" ||
  effectBddE2eScript.test(script);

const requiredDirectoryForScript = (script: string): Option.Option<string> => {
  const exact = Fn.pipe(exactScriptDirectories, Rec.get(script));
  if (Option.isSome(exact)) {
    return exact;
  }
  return isE2eStepsScript(script) ? Option.some("test/e2e") : Option.none();
};

const bunfigViolations = async (): Promise<ReadonlyArray<string>> => {
  const paths = [...new Bun.Glob("**/bunfig.toml").scanSync(".")];
  const entries = await Promise.all(
    Arr.map(paths, async (path) => [path, await readText(path)] as const),
  );
  const badIgnores = Fn.pipe(
    entries,
    Arr.flatMap(([path, text]) =>
      Fn.pipe(
        coverageIgnoreValues(text),
        Arr.filter((value) => !allowedIgnore(value)),
        Arr.map((value) => `${path}: ${value}`),
      ),
    ),
  );
  const badThresholds = Fn.pipe(
    entries,
    Arr.flatMap(([path, text]) =>
      Fn.pipe(
        coverageThresholdValues(text),
        Arr.filter((value) => !thresholdIs100(value)),
        Arr.map((value) => `${path}: coverageThreshold = ${value}`),
      ),
    ),
  );

  return [...badIgnores, ...badThresholds];
};

const regexMatches = (pattern: RegExp, text: string): ReadonlyArray<RegExpExecArray> => {
  const match = pattern.exec(text);
  return match === null ? [] : [match, ...regexMatches(pattern, text)];
};

const matchGroup = (match: RegExpExecArray, index: number): string =>
  Fn.pipe(
    match,
    Arr.get(index),
    Option.getOrElse(() => ""),
  );

const coverageIgnoreValues = (text: string): ReadonlyArray<string> =>
  Fn.pipe(
    regexMatches(/coveragePathIgnorePatterns\s*=\s*\[([^\]]*)\]/g, text),
    Arr.flatMap((match) =>
      Fn.pipe(
        regexMatches(/"([^"]+)"/g, matchGroup(match, 1)),
        Arr.map((item) => matchGroup(item, 1)),
      ),
    ),
  );

const coverageThresholdValues = (text: string): ReadonlyArray<string> =>
  Fn.pipe(
    regexMatches(/coverageThreshold\s*=\s*([^\n]+)/g, text),
    Arr.map((match) => Str.trim(matchGroup(match, 1))),
  );

const strykerViolations = async (directory: string): Promise<ReadonlyArray<string>> => {
  const path = `${directory}/stryker.config.json`;
  if (!(await fileExists(path))) {
    return [`${directory}: missing stryker.config.json`];
  }

  const config = await readJson<{
    readonly thresholds?: Readonly<Record<string, unknown>>;
    readonly bun?: { readonly testFiles?: unknown };
  }>(path);
  const thresholds = config.thresholds ?? {};
  const badThresholds = Fn.pipe(
    Arr.make("high", "low", "break"),
    Arr.filter((name) => Fn.pipe(thresholds, Rec.get(name), Option.getOrUndefined) !== 100),
    Arr.map((name) => `${path}: thresholds.${name} must be 100`),
  );
  const testFiles = stringsOnly(config.bun?.testFiles);
  const broadTestFiles = Fn.pipe(
    testFiles,
    Arr.filter(
      (value: string) => value === "test/**/*.test.ts" || value === "test/**/*.property.test.ts",
    ),
    Arr.map(
      (value: string) => `${path}: bun.testFiles should use explicit unit/property globs: ${value}`,
    ),
  );

  return [...badThresholds, ...broadTestFiles];
};

const packageViolations = async (): Promise<ReadonlyArray<string>> => {
  const violations = await Promise.all(
    Arr.map(packageDirectories, async (directory) => {
      const packageJsonPath = `${directory}/package.json`;
      const packageJson = await readJson<{ readonly scripts?: Readonly<Record<string, unknown>> }>(
        packageJsonPath,
      );
      const scripts = packageJson.scripts ?? {};
      const missing = await Promise.all(
        Arr.map(Arr.make("bunfig.toml"), async (file) =>
          (await fileExists(`${directory}/${file}`))
            ? Option.none<string>()
            : Option.some(`${directory}: missing ${file}`),
        ),
      );
      const missingScripts = Fn.pipe(
        commonScriptNames,
        Arr.filter((name) => missingRecordKey(scripts, name)),
        Arr.map((name) => `${packageJsonPath}: missing scripts.${name}`),
      );
      const missingScriptDirectories = await Promise.all(
        Fn.pipe(
          scripts,
          Rec.toEntries,
          Arr.map(async ([name, script]) => {
            const requiredDirectory = requiredDirectoryForScript(String(script));
            if (Option.isNone(requiredDirectory)) {
              return Option.none<string>();
            }
            return (await fileExists(`${directory}/${requiredDirectory.value}`))
              ? Option.none<string>()
              : Option.some(
                  `${packageJsonPath}: scripts.${name} references missing ${requiredDirectory.value}`,
                );
          }),
        ),
      );
      const stryker = await strykerViolations(directory);

      return [
        ...compactOptions(missing),
        ...missingScripts,
        ...compactOptions(missingScriptDirectories),
        ...stryker,
      ];
    }),
  );

  return Fn.pipe(violations, Arr.flatten);
};

const rootPackageViolations = async (): Promise<ReadonlyArray<string>> => {
  const packageJson = await readJson<{ readonly scripts?: Readonly<Record<string, unknown>> }>(
    "package.json",
  );
  const scripts = packageJson.scripts ?? {};
  return Fn.pipe(
    rootPolicyScriptNames,
    Arr.filter((name) => missingRecordKey(scripts, name)),
    Arr.map((name) => `package.json: missing scripts.${name}`),
  );
};

const violations = [
  ...(await bunfigViolations()),
  ...(await packageViolations()),
  ...(await rootPackageViolations()),
];

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `Package policy violation. Packages with src/** need consistent scripts, truthful test paths, bunfig.toml, stryker.config.json, and 100% thresholds:\n${Fn.pipe(
      violations,
      Arr.join("\n"),
    )}`,
  );
}
