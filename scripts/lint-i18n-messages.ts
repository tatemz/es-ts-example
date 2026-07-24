import ts from "typescript";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Rec from "effect/Record";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

type CatalogEntry = {
  readonly file: string;
  readonly line: number;
  readonly id: string;
};

const catalogPaths = Fn.pipe(
  [...new Bun.Glob("packages/web/src/**/*.messages.ts").scanSync(".")],
  Arr.dedupe,
);

const referencePaths = Fn.pipe(
  [
    ...new Bun.Glob("packages/web/src/**/*.ts").scanSync("."),
    ...new Bun.Glob("packages/web/src/**/*.tsx").scanSync("."),
    ...new Bun.Glob("packages/web/test/**/*.ts").scanSync("."),
    ...new Bun.Glob("packages/web/test/**/*.tsx").scanSync("."),
  ],
  Arr.dedupe,
  Arr.filter((path) => !Fn.pipe(path, Str.endsWith(".messages.ts"))),
);

const readText = async (path: string): Promise<string> => await Bun.file(path).text();

const catalogEntries = async (file: string): Promise<ReadonlyArray<CatalogEntry>> => {
  const sourceFile = ts.createSourceFile(file, await readText(file), ts.ScriptTarget.Latest, true);
  const entriesForNode = (node: ts.Node): ReadonlyArray<CatalogEntry> => {
    const own =
      ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)
        ? [
            {
              file,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
              id: node.name.text,
            },
          ]
        : [];
    return [...own, ...Fn.pipe(node.getChildren(), Arr.flatMap(entriesForNode))];
  };
  return entriesForNode(sourceFile);
};

const entries = Fn.pipe(await Promise.all(Arr.map(catalogPaths, catalogEntries)), Arr.flatten);

const duplicateViolations = Fn.pipe(
  entries,
  Arr.groupBy((entry) => entry.id),
  Rec.values,
  Arr.filter((group) => group.length >= 2),
  Arr.map(
    (group) =>
      `Message id "${Arr.headNonEmpty(group).id}" is defined ${group.length} times: ${Fn.pipe(
        group,
        Arr.map((entry) => `${entry.file}:${entry.line}`),
        Arr.join(", "),
      )}. Catalog spreads silently override duplicates.`,
  ),
);

const referenceTexts = await Promise.all(Arr.map(referencePaths, readText));

const referencedSomewhere = (id: string): boolean =>
  Fn.pipe(referenceTexts, Arr.some(Str.includes(`"${id}"`)));

const orphanViolations = Fn.pipe(
  entries,
  Arr.filter((entry) => !referencedSomewhere(entry.id)),
  Arr.map(
    (entry) =>
      `${entry.file}:${entry.line}: message id "${entry.id}" is never referenced; delete the entry or wire it up.`,
  ),
);

const violations = [...duplicateViolations, ...orphanViolations];

if (violations.length > 0) {
  failPolicy(
    `Message catalogs must stay duplicate-free and fully used:\n${Arr.join(violations, "\n")}`,
  );
}
