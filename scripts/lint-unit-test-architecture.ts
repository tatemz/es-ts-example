import ts from "typescript";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type PackagePolicy = {
  readonly directory: string;
  readonly enforceSlices: boolean;
  readonly slices: ReadonlyArray<string>;
};

type FileLimits = {
  readonly indexMaxLines: number;
  readonly indexMaxTests: number;
  readonly indexMaxSourceImports: number;
  readonly fileMaxLines: number;
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
    slices: Arr.make("articles", "counter", "html", "i18n", "index", "web-infrastructure"),
  },
];

// Only the packages that carry the sliced-test contract get size limits; the
// remaining packages are still held to the slice policy above.
const fileLimits: Readonly<Record<string, FileLimits>> = {
  "packages/application": {
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
  "packages/domain": {
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
  "packages/web": {
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
};

const unitTestPattern = /^packages\/[^/]+\/test\/unit\/.*\.test\.tsx?$/;
const packageDirectoryPattern = /^(packages\/[^/]+)\//;
const indexTestPattern = /^packages\/[^/]+\/test\/unit\/index\.test\.tsx?$/;
const supportPattern = /^packages\/[^/]+\/test\/unit\/support\//;
const supportBarrelPattern = /^packages\/[^/]+\/test\/unit\/support\/index\.tsx?$/;
const hiddenAssertionPattern = /\b(?:expect|assert)\s*(?:\.|\()/;
const testCallNames = Arr.make("test", "testEffect");
const packageSourceImportPattern = /^\.\.\/\.\.\/src\//;
const forbiddenIndexImportPattern =
  /^\.\.\/\.\.\/src\/(?!index\.ts$)|\.(?:model|factory|view|controller|service|repository)\.tsx?$/;

const packageDirectory = (path: string): string => packageDirectoryPattern.exec(path)?.[1] ?? "";

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
            ),
        ),
        Arr.map((slice) => ({
          path: `${policy.directory}/test/unit`,
          message: `missing required unit test slice ${slice}.`,
        })),
      )
    : [];

const importSpecifiers = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  Fn.pipe(
    sourceFile.statements,
    Arr.filter(ts.isImportDeclaration),
    Arr.filter((statement) => ts.isStringLiteral(statement.moduleSpecifier)),
    Arr.map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text),
  );

const calleeName = (node: ts.Node): string =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) ? node.expression.text : "";

const isTestCall = (node: ts.Node): boolean =>
  Fn.pipe(testCallNames, Arr.contains(calleeName(node)));

const testCallCount = (node: ts.Node): number =>
  Fn.pipe(
    node.getChildren(),
    Arr.map(testCallCount),
    Arr.reduce(isTestCall(node) ? 1 : 0, (total, count) => total + count),
  );

const overLimit = (
  path: string,
  actual: number,
  max: number,
  subject: string,
): ReadonlyArray<Violation> =>
  actual > max ? [{ path, message: `has ${actual} ${subject}; maximum is ${max}.` }] : [];

const indexTestViolations = (
  path: string,
  sourceFile: ts.SourceFile,
  limits: FileLimits,
  lines: number,
): ReadonlyArray<Violation> => {
  const imports = importSpecifiers(sourceFile);
  const sourceImports = Fn.pipe(
    imports,
    Arr.filter((specifier) => packageSourceImportPattern.test(specifier)),
  );
  return [
    ...overLimit(path, lines, limits.indexMaxLines, "lines"),
    ...overLimit(path, testCallCount(sourceFile), limits.indexMaxTests, "test calls"),
    ...overLimit(
      path,
      Arr.length(sourceImports),
      limits.indexMaxSourceImports,
      "package source imports",
    ),
    ...Fn.pipe(
      imports,
      Arr.filter((specifier) => forbiddenIndexImportPattern.test(specifier)),
      Arr.map((specifier) => ({
        path,
        message: `index tests must not import ${specifier}; use a slice test.`,
      })),
    ),
  ];
};

const supportViolations = (path: string, text: string): ReadonlyArray<Violation> => [
  ...(supportBarrelPattern.test(path)
    ? [{ path, message: "unit support barrels are banned; import concrete support files." }]
    : []),
  ...(hiddenAssertionPattern.test(text)
    ? [{ path, message: "unit support files must not hide assertions." }]
    : []),
];

const testFileViolations = (
  path: string,
  text: string,
  limits: FileLimits,
): ReadonlyArray<Violation> => {
  const lines = Arr.length(Fn.pipe(text, Str.split("\n")));
  return indexTestPattern.test(path)
    ? indexTestViolations(
        path,
        ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true),
        limits,
        lines,
      )
    : overLimit(path, lines, limits.fileMaxLines, "lines");
};

const fileViolations = async (path: string): Promise<ReadonlyArray<Violation>> => {
  const text = await Bun.file(path).text();
  if (supportPattern.test(path)) {
    return supportViolations(path, text);
  }

  const limits = fileLimits[packageDirectory(path)];
  return limits === undefined ? [] : testFileViolations(path, text, limits);
};

const unitTestFiles = Fn.pipe(
  trackedTextFiles(),
  Arr.filter((path) => unitTestPattern.test(path)),
);
const supportFiles = Fn.pipe(
  trackedTextFiles(),
  Arr.filter((path) => supportPattern.test(path) && /\.tsx?$/.test(path)),
);
const packageFiles = Fn.pipe(
  unitTestFiles,
  Arr.reduce({} as Readonly<Record<string, ReadonlyArray<string>>>, (byPackage, path) => ({
    ...byPackage,
    [packageDirectory(path)]: [...(byPackage[packageDirectory(path)] ?? []), path],
  })),
);
const perFileViolations = await Promise.all(
  Fn.pipe([...unitTestFiles, ...supportFiles], Arr.dedupe, Arr.map(fileViolations)),
);
const violations = Fn.pipe(
  [
    ...Fn.pipe(
      packagePolicies,
      Arr.flatMap((policy) => missingSliceViolations(policy, packageFiles[policy.directory] ?? [])),
    ),
    ...Arr.flatten(perFileViolations),
  ],
  Arr.dedupe,
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
