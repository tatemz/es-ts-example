import Path from "node:path";
import ts from "typescript";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import * as Str from "effect/String";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type Violation = {
  readonly path: string;
  readonly value: string;
  readonly message: string;
};

const packageJsonPattern = /(?:^|\/)package\.json$/;
const typeScriptPattern = /\.tsx?$/;
// `../../features/` is the repo-root shared Gherkin directory; package scripts
// reaching it stay inside the repository, so only other parent escapes fail.
const parentEscapePattern = /\.\.\/\.\.(?!\/features\/)/;
const eventStoreDumpPattern =
  /(?:^|\/)(?:\.new\d*\.json|[^/]*\.events\.json|\.counter-events\.json)$/;

const scriptViolations = async (path: string): Promise<ReadonlyArray<Violation>> => {
  const packageJson = await Bun.file(path).json();
  const scripts = packageJson.scripts ?? {};
  return Fn.pipe(
    scripts,
    Rec.toEntries,
    Arr.flatMap(([name, value]) => {
      const script = String(value);
      return parentEscapePattern.test(script)
        ? [
            {
              path,
              value: `${name}: ${script}`,
              message:
                "Package scripts must not escape the repository unless they are named policy exceptions.",
            },
          ]
        : [];
    }),
  );
};

const escapesRepo = (path: string, value: string): boolean => {
  if (!Fn.pipe(value, Str.startsWith(".."))) {
    return false;
  }

  const resolved = Path.posix.normalize(`${Path.posix.dirname(path)}/${value}`);
  return resolved === ".." || Fn.pipe(resolved, Str.startsWith("../"));
};

const pathLiteral = (node: ts.Node): string | undefined => {
  if (ts.isStringLiteral(node)) {
    return node.text;
  }
  return ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
};

const literalViolations = async (path: string): Promise<ReadonlyArray<Violation>> => {
  const sourceFile = ts.createSourceFile(
    path,
    await Bun.file(path).text(),
    ts.ScriptTarget.Latest,
    true,
  );
  const violationsForNode = (node: ts.Node): ReadonlyArray<Violation> => {
    const value = pathLiteral(node);
    const own =
      value !== undefined && escapesRepo(path, value)
        ? [
            {
              path,
              value,
              message:
                "Relative paths must not escape the repository unless they are named policy exceptions.",
            },
          ]
        : [];
    return [...own, ...Fn.pipe(node.getChildren(), Arr.flatMap(violationsForNode))];
  };
  return violationsForNode(sourceFile);
};

const dumpViolations = (path: string): ReadonlyArray<Violation> =>
  eventStoreDumpPattern.test(path)
    ? [
        {
          path,
          value: path,
          message:
            "Event-store session dumps must not be tracked; delete the file and write runtime state outside the repository.",
        },
      ]
    : [];

const files = trackedTextFiles();
const checked = await Promise.all([
  ...Fn.pipe(
    files,
    Arr.filter((path) => packageJsonPattern.test(path)),
    Arr.map(scriptViolations),
  ),
  ...Fn.pipe(
    files,
    Arr.filter((path) => typeScriptPattern.test(path)),
    Arr.map(literalViolations),
  ),
]);
const violations = Fn.pipe([...checked, ...Arr.map(files, dumpViolations)], Arr.flatten);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    Fn.pipe(
      violations,
      Arr.map((violation) => `${violation.path}: ${violation.message} (${violation.value})`),
      Arr.join("\n"),
    ),
  );
}
