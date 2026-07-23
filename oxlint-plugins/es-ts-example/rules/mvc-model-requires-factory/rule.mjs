import { existsSync } from "node:fs";
import * as Fn from "effect/Function";
import * as Str from "effect/String";

import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { stemFromModelFilename } from "../shared/mvc-ownership.mjs";
import { factoryPathForStem, webSrcRootFromFilename } from "../shared/paths.mjs";

export const mvcModelRequiresFactoryRuleName = "mvc-model-requires-factory";

const modelSuffix = ".model.ts";

const isModelFile = (filename) => Fn.pipe(getBasename(filename), Str.endsWith(modelSuffix));

export const mvcModelRequiresFactory = {
  meta: {
    type: "problem",
    docs: {
      description: "Require web MVC model files to have a matching factory in the factories lane.",
    },
    messages: {
      missingFactory:
        "Model files must have a matching factory in `../factories/`. Create {{factoryFilename}}.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isModelFile(filename)) {
      return {};
    }

    const stem = stemFromModelFilename(filename);
    const factoryFilename = `${stem}.factory.ts`;
    const factoryPath = factoryPathForStem(webSrcRootFromFilename(filename), stem);

    if (existsSync(factoryPath)) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          messageId: "missingFactory",
          data: { factoryFilename },
        });
      },
    };
  },
};
