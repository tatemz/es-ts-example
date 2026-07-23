import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import * as Str from "effect/String";
import { trackedTextFiles } from "./policy-files.ts";
import { failPolicy } from "./policy-output.ts";

type Violation = {
  readonly path: string;
  readonly script: string;
  readonly value: string;
};

const packageJsonPattern = /^packages\/[^/]+\/package\.json$/;

const normalizedScript = (value: string): string => Str.toLowerCase(Str.trim(value));

const noopScript = (value: string): boolean => {
  const normalized = normalizedScript(value);
  return (
    normalized === "true" ||
    normalized === ":" ||
    normalized === "exit 0" ||
    Fn.pipe(normalized, Str.startsWith("echo "))
  );
};

const violationsForPackage = async (path: string): Promise<ReadonlyArray<Violation>> => {
  const packageJson = await Bun.file(path).json();
  const scripts = packageJson.scripts ?? {};
  return Fn.pipe(
    scripts,
    Rec.toEntries,
    Arr.filter(([, value]) => noopScript(String(value))),
    Arr.map(([script, value]) => ({
      path,
      script,
      value: String(value),
    })),
  );
};

const checked = await Promise.all(
  Fn.pipe(
    trackedTextFiles(),
    Arr.filter((path) => packageJsonPattern.test(path)),
    Arr.map(violationsForPackage),
  ),
);
const violations = Fn.pipe(checked, Arr.flatten);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    Fn.pipe(
      violations,
      Arr.map(
        (violation) =>
          `${violation.path}: scripts.${violation.script} is a no-op (${violation.value}). Use a real check or remove it from the lifecycle.`,
      ),
      Arr.join("\n"),
    ),
  );
}
