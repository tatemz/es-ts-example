import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type SuppressionPattern = {
  readonly name: string;
  readonly pattern: RegExp;
};

type Violation = {
  readonly path: string;
  readonly patternName: string;
};

const joined = (left: string, right: string): string => `${left}${right}`;

const suppressionPatterns: ReadonlyArray<SuppressionPattern> = Arr.make(
  {
    name: "Oxlint disable directive",
    pattern: new RegExp(joined("oxlint", "-disable")),
  },
  {
    name: "TypeScript ignore directive",
    pattern: new RegExp(joined("@ts", "-ignore")),
  },
  {
    name: "TypeScript expect-error directive",
    pattern: new RegExp(joined("@ts", "-expect-error")),
  },
  {
    name: "TypeScript nocheck directive",
    pattern: new RegExp(joined("@ts", "-nocheck")),
  },
  {
    name: "Oxlint ignore directive",
    pattern: new RegExp(joined("oxlint", "-ignore")),
  },
  {
    name: "Stryker disable directive",
    pattern: new RegExp(`${"stryker"} ${"disable"}`),
  },
);

const canaryText = `
${joined("oxlint", "-disable")}
${joined("@ts", "-ignore")}
${joined("@ts", "-expect-error")}
${joined("@ts", "-nocheck")}
${joined("oxlint", "-ignore")}
${"stryker"} ${"disable"}
`;

const canaryFailures = Fn.pipe(
  suppressionPatterns,
  Arr.filter((entry) => !entry.pattern.test(canaryText)),
  Arr.map((entry) => `Canary did not fire for ${entry.name}.`),
);

const violationsForText = (path: string, text: string): ReadonlyArray<Violation> =>
  Fn.pipe(
    suppressionPatterns,
    Arr.filter((entry) => entry.pattern.test(text)),
    Arr.map((entry) => ({
      path,
      patternName: entry.name,
    })),
  );

const fileViolations = await Promise.all(
  Fn.pipe(
    trackedTextFiles(),
    Arr.map(async (path) => violationsForText(path, await Bun.file(path).text())),
  ),
);
const violations = Fn.pipe(fileViolations, Arr.flatten);

if (!Arr.isReadonlyArrayEmpty(canaryFailures) || !Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    Fn.pipe(
      [
        ...canaryFailures,
        ...Fn.pipe(
          violations,
          Arr.map(
            (violation) =>
              `${violation.path}: ${violation.patternName} comments are not allowed. Fix the code or add a named policy exception in code, not an ignore comment.`,
          ),
        ),
      ],
      Arr.join("\n"),
    ),
  );
}
