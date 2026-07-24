import { existsSync, readdirSync } from "node:fs";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";

import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { modelPathForStem, webMvcLayer, webSrcRootFromFilename } from "../shared/paths.mjs";

export const mvcViewRequiresModelSiblingRuleName = "mvc-view-requires-model-sibling";

const viewSuffix = ".view.tsx";
const modelSuffix = ".model.ts";

const modelFilenameForView = (basename) =>
  `${Fn.pipe(basename, Str.replace(/\.view\.tsx$/, ""))}${modelSuffix}`;

const hasModelOrVariant = (filename, basename, layer) => {
  const webRoot = webSrcRootFromFilename(filename);
  const modelsDir = `${webRoot}/models/${layer}`;
  const viewStem = Fn.pipe(basename, Str.replace(/\.view\.tsx$/, ""));
  const exact = modelPathForStem(webRoot, layer, viewStem);

  if (existsSync(exact)) {
    return true;
  }

  if (!existsSync(modelsDir)) {
    return false;
  }

  return Fn.pipe(
    readdirSync(modelsDir),
    Arr.some(
      (entry) =>
        Fn.pipe(entry, Str.endsWith(modelSuffix)) &&
        viewStem !== Fn.pipe(entry, Str.replace(/\.model\.ts$/, "")) &&
        Fn.pipe(viewStem, Str.startsWith(Fn.pipe(entry, Str.replace(/\.model\.ts$/, "")))),
    ),
  );
};

export const mvcViewRequiresModelSibling = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require each web MVC `*.view.tsx` file to have a matching model in the models lane.",
    },
    messages: {
      missingModel:
        "View files must have a matching model in `../models/`. Create {{modelFilename}}.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename)) {
      return {};
    }

    const basename = getBasename(filename);
    if (!Fn.pipe(basename, Str.endsWith(viewSuffix))) {
      return {};
    }

    const layer = webMvcLayer(filename);
    if (layer === undefined) {
      return {};
    }

    const modelFilename = `${layer}/${modelFilenameForView(basename)}`;
    if (hasModelOrVariant(filename, basename, layer)) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          messageId: "missingModel",
          data: { modelFilename },
        });
      },
    };
  },
};
