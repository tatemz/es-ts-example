import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type Violation = {
  readonly path: string;
  readonly value: string;
  readonly message: string;
};

const packageJsonPattern = /(?:^|\/)package\.json$/;
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
const checked = await Promise.all(
  Fn.pipe(
    files,
    Arr.filter((path) => packageJsonPattern.test(path)),
    Arr.map(scriptViolations),
  ),
);
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
