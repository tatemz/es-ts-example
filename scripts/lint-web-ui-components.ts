import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

/**
 * Pages are the web package's public surface: a controller picks a page model,
 * and an embedder renders the matching page view. Controls are internal
 * building blocks, so exporting one would leak a detail nobody outside can use.
 */
const pageViewPaths = (): ReadonlyArray<string> => [
  ...new Bun.Glob("packages/web/src/views/pages/*.view.tsx").scanSync("."),
];

const stemFromViewPath = (viewPath: string): string =>
  Fn.pipe(viewPath, Str.replace(/^.*\//, ""), Str.replace(/\.view\.tsx$/, ""));

const exportsLine = (indexText: string, line: string): boolean => indexText.includes(line);

const missingExportsForPage = (
  indexText: string,
  viewPath: string,
): ReadonlyArray<Option.Option<string>> => {
  const stem = stemFromViewPath(viewPath);
  const modelExport = `export * from "./models/pages/${stem}.model.ts";`;
  const viewExport = `export { ${stem}View } from "./views/pages/${stem}.view.tsx";`;

  return [
    exportsLine(indexText, modelExport)
      ? Option.none()
      : Option.some(`packages/web/src/index.ts: missing \`${modelExport}\``),
    exportsLine(indexText, viewExport)
      ? Option.none()
      : Option.some(`packages/web/src/index.ts: missing \`${viewExport}\``),
  ];
};

const controlExportedFromIndex = (indexText: string): ReadonlyArray<Option.Option<string>> =>
  Fn.pipe(
    [...new Bun.Glob("packages/web/src/{models,views,factories}/controls/*").scanSync(".")],
    Arr.map((path) => {
      const relativePath = Fn.pipe(path, Str.replace(/^packages\/web\/src\//, "./"));
      return indexText.includes(`"${relativePath}"`)
        ? Option.some(
            `packages/web/src/index.ts: controls are internal, so ${path} must not be exported`,
          )
        : Option.none();
    }),
  );

const indexText = await Bun.file("packages/web/src/index.ts").text();
const violations = Fn.pipe(
  [
    ...Fn.pipe(
      pageViewPaths(),
      Arr.flatMap((viewPath) => missingExportsForPage(indexText, viewPath)),
    ),
    ...controlExportedFromIndex(indexText),
  ],
  Arr.filter(Option.isSome),
  Arr.map((violation) => violation.value),
);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(`Web UI component policy violation:\n${Fn.pipe(violations, Arr.join("\n"))}`);
}
