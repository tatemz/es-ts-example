import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { policyExceptionNamed, policyExceptions } from "./policy-exceptions.ts";
import { failPolicy } from "./policy-output.ts";

/**
 * A policy exception rots in two directions, and both read as a live escape
 * hatch while protecting nothing: an allowlisted path can be deleted, and a
 * script can ask for a name nobody defines. `namedExceptionAllowsPath` returns
 * `false` for an unknown name, so the second case fails closed and silently.
 */
const namedExceptionCallSite = /namedExceptionAllowsPath\(\s*"([^"]+)"/g;

const definitionPath = "scripts/policy-exceptions.ts";

const scriptSources = (): ReadonlyArray<string> =>
  Fn.pipe(
    [
      ...new Bun.Glob("scripts/*.ts").scanSync("."),
      ...new Bun.Glob("oxlint-plugins/**/*.mjs").scanSync("."),
    ],
    Arr.filter((path) => path !== definitionPath),
  );

const readScriptSources = async (): Promise<ReadonlyArray<string>> =>
  await Promise.all(
    Fn.pipe(
      scriptSources(),
      Arr.map(async (path) => await Bun.file(path).text()),
    ),
  );

/** Names passed to `namedExceptionAllowsPath` as a literal at the call site. */
const literalCallSiteNames = (sources: ReadonlyArray<string>): ReadonlyArray<string> =>
  Fn.pipe(
    sources,
    Arr.flatMap((source) => [...Str.matchAll(namedExceptionCallSite)(source)]),
    Arr.map((match) => match[1]),
    Arr.filter((name): name is string => name !== undefined),
    Arr.dedupe,
  );

/**
 * A script may also look a name up through a table rather than at the call
 * site, so mentioning the name anywhere outside the definition counts as use.
 */
const mentionedNames = (sources: ReadonlyArray<string>): ReadonlyArray<string> =>
  Fn.pipe(
    policyExceptions,
    Arr.map((exception) => exception.name),
    Arr.filter((name) =>
      Fn.pipe(
        sources,
        Arr.some((source) => Fn.pipe(source, Str.includes(`"${name}"`))),
      ),
    ),
  );

const isGlob = (path: string): boolean => /[*?[\]{}!]/.test(path);

const allowlistedPaths = (): ReadonlyArray<{ readonly name: string; readonly path: string }> =>
  Fn.pipe(
    policyExceptions,
    Arr.flatMap((exception) =>
      Fn.pipe(
        exception.paths,
        Arr.filter((path) => !isGlob(path)),
        Arr.map((path) => ({ name: exception.name, path })),
      ),
    ),
  );

const missingPathViolations = async (): Promise<ReadonlyArray<string>> => {
  const checked = await Promise.all(
    Fn.pipe(
      allowlistedPaths(),
      Arr.map(async (entry) => ({ ...entry, exists: await Bun.file(entry.path).exists() })),
    ),
  );

  return Fn.pipe(
    checked,
    Arr.filter((entry) => !entry.exists),
    Arr.map((entry) => `${entry.name} allowlists ${entry.path}, which does not exist.`),
  );
};

const undefinedNameViolations = (requested: ReadonlyArray<string>): ReadonlyArray<string> =>
  Fn.pipe(
    requested,
    Arr.filter((name) => policyExceptionNamed(name) === undefined),
    Arr.map(
      (name) =>
        `a script asks for policy exception "${name}", which scripts/policy-exceptions.ts does not define.`,
    ),
  );

const unusedExceptionViolations = (used: ReadonlyArray<string>): ReadonlyArray<string> =>
  Fn.pipe(
    policyExceptions,
    Arr.filter((exception) => !Fn.pipe(used, Arr.contains(exception.name))),
    Arr.map(
      (exception) =>
        `policy exception "${exception.name}" is defined but no script asks for it; delete it or wire it up.`,
    ),
  );

const sources = await readScriptSources();
const violations = [
  ...(await missingPathViolations()),
  ...undefinedNameViolations(literalCallSiteNames(sources)),
  ...unusedExceptionViolations(mentionedNames(sources)),
];

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(`Policy exception health violations:\n${Fn.pipe(violations, Arr.join("\n"))}`);
}
