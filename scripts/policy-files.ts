import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

type GitFileResult = {
  readonly exitCode: number;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
};

const decoder = new TextDecoder();

const decode = (bytes: Uint8Array): string => decoder.decode(bytes);

const gitFiles = (args: ReadonlyArray<string>): GitFileResult =>
  Bun.spawnSync(["git", "ls-files", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

const gitFileLines = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const result = gitFiles(args);
  if (result.exitCode !== 0) {
    return failPolicy(`Could not list repository files:\n${decode(result.stderr)}`);
  }

  return Fn.pipe(
    decode(result.stdout),
    Str.split("\n"),
    Arr.filter((path) => path !== ""),
  );
};

export const trackedFiles = (): ReadonlyArray<string> => {
  const deleted = gitFileLines(Arr.make("--deleted"));
  const files = gitFileLines(Arr.make("--cached", "--others", "--exclude-standard"));

  return Fn.pipe(
    files,
    Arr.filter((path) => !Fn.pipe(deleted, Arr.contains(path))),
  );
};

export const trackedTextFiles = (): ReadonlyArray<string> =>
  Fn.pipe(trackedFiles(), Arr.filter(textFilePath));

const textFilePattern =
  /(?:^|\/)(?:AGENTS\.md|package\.json|tsconfig(?:\.[^.]+)?\.json|\.oxlintrc\.json|\.oxfmtrc\.json|knip\.json|bunfig\.toml|stryker\.config\.json|.*\.(?:ts|tsx|js|jsx|mjs|json|jsonc|md|toml|yaml|yml|css|html|feature))$/;

export const textFilePath = (path: string): boolean => textFilePattern.test(path);
