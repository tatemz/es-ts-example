import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { failPolicy } from "./policy-output.ts";

type UiComponent = {
  readonly viewPath: string;
  readonly modelPath: string;
};

const themePattern = "(?:wayfinder|field-notes)";

const readText = async (path: string): Promise<string> => await Bun.file(path).text();
const fileExistsSync = (path: string): boolean =>
  !Arr.isReadonlyArrayEmpty([...new Bun.Glob(path).scanSync(".")]);

const stemFromViewPath = (path: string): string =>
  Fn.pipe(
    path,
    Str.replace(/^packages\/web\/src\//, ""),
    Str.replace(/\.view\.tsx$/, ""),
    Str.replace(/^.*\//, ""),
  );

const modelPathFromViewPath = (path: string): string =>
  Fn.pipe(
    path,
    Str.replace(
      new RegExp(`^packages\\/web\\/src\\/views\\/${themePattern}\\/`),
      "packages/web/src/models/",
    ),
    Str.replace(/\.view\.tsx$/, ".model.ts"),
  );

const modelPathForViewPath = (path: string): string => {
  const exact = modelPathFromViewPath(path);
  if (fileExistsSync(exact)) {
    return exact;
  }

  const directory = Fn.pipe(exact, Str.replace(/\/[^/]+$/, ""));
  const stem = stemFromViewPath(path);
  return (
    Fn.pipe(
      [...new Bun.Glob(`${directory}/*.model.ts`).scanSync(".")],
      Arr.findFirst((modelPath) =>
        Fn.pipe(
          stem,
          Str.startsWith(
            Fn.pipe(modelPath, Str.replace(/^.*\//, ""), Str.replace(/\.model\.ts$/, "")),
          ),
        ),
      ),
      Option.getOrUndefined,
    ) ?? exact
  );
};

const uiComponents = (): ReadonlyArray<UiComponent> =>
  Fn.pipe(
    [...new Bun.Glob("packages/web/src/**/*.view.tsx").scanSync(".")],
    Arr.map((viewPath) => ({
      viewPath,
      modelPath: modelPathForViewPath(viewPath),
    })),
  );

const exportedFromPackageIndex = (indexText: string, path: string): boolean => {
  const relativePath = Fn.pipe(path, Str.replace(/^packages\/web\/src\//, "./"));
  const escapedPath = Fn.pipe(relativePath, Str.replaceAll(".", "\\."), Str.replaceAll("/", "\\/"));
  return new RegExp(`export \\* from "${escapedPath}";`).test(indexText);
};

const themedViewExported = (indexText: string, viewPath: string): boolean => {
  const theme = Fn.pipe(
    viewPath,
    Str.replace(/^packages\/web\/src\/views\//, ""),
    Str.replace(/\/[^/]+$/, ""),
  );
  if (theme !== "wayfinder" && theme !== "field-notes") {
    return false;
  }

  const viewName = Fn.pipe(viewPath, Str.replace(/^.*\//, ""), Str.replace(/\.view\.tsx$/, "View"));
  const themeName = theme === "wayfinder" ? "Wayfinder" : "FieldNotes";
  return new RegExp(
    `export \\{ ${viewName} as ${themeName}${viewName} \\} from "\\.\\/views\\/${theme}\\/${Fn.pipe(
      viewPath,
      Str.replace(/^.*\//, ""),
      Str.replaceAll(".", "\\."),
    )}";`,
  ).test(indexText);
};

const isPrimitiveComponent = (component: UiComponent): boolean =>
  new RegExp(`^packages/web/src/views/${themePattern}/EsTsExample`).test(component.viewPath);

const optionToArray = (violation: Option.Option<string>): ReadonlyArray<string> =>
  Option.match(violation, { onNone: () => [], onSome: (value) => [value] });

const modelIndexViolation = (component: UiComponent, packageIndex: string): Option.Option<string> =>
  isPrimitiveComponent(component) || exportedFromPackageIndex(packageIndex, component.modelPath)
    ? Option.none()
    : Option.some(`packages/web/src/index.ts: missing export for ${component.modelPath}`);

const viewIndexViolation = (
  component: UiComponent,
  packageIndex: string,
): Option.Option<string> => {
  if (isPrimitiveComponent(component)) {
    return Option.none();
  }

  return themedViewExported(packageIndex, component.viewPath)
    ? Option.none()
    : Option.some(`packages/web/src/index.ts: missing aliased export for ${component.viewPath}`);
};

const indexViolationsForComponent = (
  component: UiComponent,
  packageIndex: string,
): ReadonlyArray<string> =>
  Fn.pipe(
    [modelIndexViolation(component, packageIndex), viewIndexViolation(component, packageIndex)],
    Arr.flatMap(optionToArray),
  );

const components = uiComponents();
const packageIndexText = await readText("packages/web/src/index.ts");
const violations = Fn.pipe(
  components,
  Arr.flatMap((component) => indexViolationsForComponent(component, packageIndexText)),
);

if (!Arr.isReadonlyArrayEmpty(violations)) {
  failPolicy(`Web UI component policy violation:\n${Fn.pipe(violations, Arr.join("\n"))}`);
}
