import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { getBasename } from "./filename.mjs";

export const modelSuffix = ".model.ts";
export const factorySuffix = ".factory.ts";
export const viewSuffix = ".view.tsx";

export const pascalCase = (value) =>
  Fn.pipe(
    value,
    Str.split("-"),
    Arr.filter((part) => part !== ""),
    Arr.map(
      (part) => `${Fn.pipe(part, Str.takeLeft(1), Str.toUpperCase)}${Fn.pipe(part, Str.slice(1))}`,
    ),
    Arr.join(""),
  );

export const isModelFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.endsWith(modelSuffix));

export const isFactoryFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.endsWith(factorySuffix));

export const isViewFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.endsWith(viewSuffix));

export const stemFromModelFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.replace(/\.model\.ts$/, ""));

export const stemFromFactoryFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.replace(/\.factory\.ts$/, ""));

export const stemFromViewFilename = (filename) =>
  Fn.pipe(getBasename(filename), Str.replace(/\.view\.tsx$/, ""));

const stemOwnership = (stem) => ({
  expectedViewName: `${stem}View`,
  factoryName: `make${stem}Model`,
  modelName: `${stem}Model`,
  stem,
  viewName: `${stem}View`,
});

export const modelOwnershipFromFilename = (filename) =>
  stemOwnership(stemFromModelFilename(filename));

export const factoryOwnershipFromFilename = (filename) =>
  stemOwnership(stemFromFactoryFilename(filename));

export const viewOwnershipFromFilename = (filename) =>
  stemOwnership(stemFromViewFilename(filename));

export const modelStemFromImportSource = (source) => {
  const match = /^\.\.\/\.\.\/models\/[^/]+\/(.+)\.model\.ts$/.exec(source);
  return match === null ? Option.none() : Fn.pipe(match, Arr.get(1));
};

export const viewOwnershipFromModelStem = (filename, modelStem) => {
  const viewStem = stemFromViewFilename(filename);
  const expectedModelName = `${modelStem}Model`;

  if (viewStem === modelStem) {
    return Option.some({
      expectedModelName,
      expectedViewName: `${modelStem}View`,
      modelStem,
      variantStem: Option.none(),
    });
  }

  const kebabVariantPrefix = `${modelStem}-`;
  const pascalVariantPrefix = modelStem;
  if (
    !Fn.pipe(viewStem, Str.startsWith(kebabVariantPrefix)) &&
    !(viewStem !== modelStem && Fn.pipe(viewStem, Str.startsWith(pascalVariantPrefix)))
  ) {
    return Option.none();
  }

  const variantStem = Fn.pipe(viewStem, Str.replace(new RegExp(`^${modelStem}-?`), ""));

  return Option.some({
    expectedModelName,
    expectedViewName: `${viewStem}View`,
    modelStem,
    variantStem: Option.some(variantStem),
  });
};
