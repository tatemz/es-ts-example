import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

const pluginPath = "oxlint-plugins/es-ts-example/index.mjs";
const testPath = "test/unit/oxlint-rules.test.mjs";

const readText = async (path: string): Promise<string> => await Bun.file(path).text();

const nodeCandidates = (): ReadonlyArray<string> =>
  Fn.pipe(
    [
      process.env.NODE24_BIN,
      process.env.NODE_24_BIN,
      `${process.env.NVM_DIR ?? `${process.env.HOME ?? ""}/.nvm`}/versions/node/v24.16.0/bin/node`,
      "node",
    ],
    Arr.filter(
      (candidate): candidate is string => candidate !== undefined && !Str.isEmpty(candidate),
    ),
  );

const nodeVersion = async (candidate: string): Promise<string> => {
  if (isAbsolute(candidate) && !(await Bun.file(candidate).exists())) {
    return "";
  }
  const command = Bun.spawn({ cmd: [candidate, "--version"], stdout: "pipe", stderr: "ignore" });
  const version = await new Response(command.stdout).text();
  return (await command.exited) === 0 ? Fn.pipe(version, Str.trim) : "";
};

const node24 = async (): Promise<string> => {
  for (const candidate of nodeCandidates()) {
    if (Fn.pipe(await nodeVersion(candidate), Str.startsWith("v24."))) {
      return candidate;
    }
  }
  return failPolicy(
    "oxlint RuleTester requires Node 24.x; set NODE24_BIN to a Node 24 executable.",
  );
};

const runRuleTester = async (node: string): Promise<void> => {
  const command = Bun.spawn({
    cmd: [node, "--test", testPath],
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await command.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
};

const customRuleNames = async (): Promise<ReadonlyArray<string>> => {
  const plugin = await import(pathToFileURL(resolve(pluginPath)).href);
  return Fn.pipe(
    Object.keys(plugin.default.rules),
    Arr.filter((name) => !Str.isEmpty(name)),
  );
};

const missingCoverage = (rules: ReadonlyArray<string>, testText: string): ReadonlyArray<string> =>
  Fn.pipe(
    rules,
    Arr.filter((rule) => !Fn.pipe(testText, Str.includes(`"${rule}"`))),
    Arr.map((rule) => `${pluginPath}: ${rule} has no RuleTester coverage in ${testPath}.`),
  );

const testText = await readText(testPath);
const violations = missingCoverage(await customRuleNames(), testText);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(
    `Every oxlint custom rule needs RuleTester coverage:\n${Fn.pipe(violations, Arr.join("\n"))}`,
  );
}

await runRuleTester(await node24());
