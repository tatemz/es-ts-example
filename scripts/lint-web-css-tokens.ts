import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

const stylesPath = "packages/web/src/styles.css";

const sourcePaths = Fn.pipe(
  [
    ...new Bun.Glob("packages/web/src/**/*.ts").scanSync("."),
    ...new Bun.Glob("packages/web/src/**/*.tsx").scanSync("."),
  ],
  Arr.dedupe,
);

const readText = async (path: string): Promise<string> => await Bun.file(path).text();

const tokenPattern = /es-ts-example-[a-z0-9-]+/g;
const definitionPattern = /--[a-z]+-es-ts-example-([a-z0-9-]+):/g;
const designIdPattern = /(?:data-design-id=|"data-design-id":\s*)["'][^"']*["']/g;

const matchTexts = (text: string, pattern: RegExp): ReadonlyArray<string> =>
  Fn.pipe(
    text,
    Str.matchAll(pattern),
    Arr.fromIterable,
    Arr.map(([whole]) => whole),
  );

const definedTokens = (await Bun.file(stylesPath).exists())
  ? Fn.pipe(
      await readText(stylesPath),
      Str.matchAll(definitionPattern),
      Arr.fromIterable,
      Arr.flatMap(([, name]) => (name === undefined ? [] : [`es-ts-example-${name}`])),
      Arr.dedupe,
    )
  : [];

type TokenUse = {
  readonly file: string;
  readonly line: number;
  readonly token: string;
};

const tokenUses = async (file: string): Promise<ReadonlyArray<TokenUse>> =>
  Fn.pipe(
    await readText(file),
    Str.replace(designIdPattern, ""),
    Str.split("\n"),
    Arr.flatMap((line, index) =>
      Fn.pipe(
        matchTexts(line, tokenPattern),
        Arr.map((token) => ({ file, line: index + 1, token })),
      ),
    ),
  );

const uses = Fn.pipe(await Promise.all(Arr.map(sourcePaths, tokenUses)), Arr.flatten);

const violations = Fn.pipe(
  uses,
  Arr.filter((use) => !Fn.pipe(definedTokens, Arr.contains(use.token))),
  Arr.map(
    (use) =>
      `${use.file}:${use.line}: class token "${use.token}" has no --*-es-ts-example-* variable in ${stylesPath}.`,
  ),
);

if (violations.length > 0) {
  failPolicy(
    `Every es-ts-example-* class token must resolve to a theme variable:\n${Arr.join(violations, "\n")}`,
  );
}
