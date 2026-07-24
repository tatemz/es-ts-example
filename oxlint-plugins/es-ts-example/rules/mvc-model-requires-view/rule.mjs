import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Str from "effect/String";

import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { stemFromModelFilename } from "../shared/mvc-ownership.mjs";
import { modelImportSourceForStem, webMvcLayer, webSrcRootFromFilename } from "../shared/paths.mjs";

export const mvcModelRequiresViewRuleName = "mvc-model-requires-view";

const modelSuffix = ".model.ts";
const viewSuffix = ".view.tsx";

const isModelFile = (filename) => Fn.pipe(getBasename(filename), Str.endsWith(modelSuffix));

const someViewImportsModel = (viewDir, importSource) =>
  Fn.pipe(
    readdirSync(viewDir),
    Arr.some((entry) => {
      if (!Fn.pipe(entry, Str.endsWith(viewSuffix))) {
        return false;
      }

      const source = readFileSync(`${viewDir}/${entry}`, "utf8");
      return source.includes(`from "${importSource}"`) || source.includes(`from '${importSource}'`);
    }),
  );

export const mvcModelRequiresView = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every web MVC model file to be imported by at least one view in the matching layer.",
    },
    messages: {
      missingViewDirectory:
        "Models must be rendered by a view. Create `src/views/{{layer}}/` and add a view that imports from `{{importSource}}`.",
      missingView:
        "Models must be rendered by a view. No view under `src/views/{{layer}}/` imports from `{{importSource}}`.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isModelFile(filename)) {
      return {};
    }

    const layer = webMvcLayer(filename);
    if (layer === undefined) {
      return {};
    }

    const stem = stemFromModelFilename(filename);
    const viewDir = `${webSrcRootFromFilename(filename)}/views/${layer}`;
    const importSource = modelImportSourceForStem(layer, stem);

    if (!existsSync(viewDir)) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "missingViewDirectory",
            data: { importSource, layer },
          });
        },
      };
    }

    if (someViewImportsModel(viewDir, importSource)) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          messageId: "missingView",
          data: { importSource, layer },
        });
      },
    };
  },
};
