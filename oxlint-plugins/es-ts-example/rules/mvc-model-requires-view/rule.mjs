import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";

import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { stemFromModelFilename } from "../shared/mvc-ownership.mjs";
import { webSrcRootFromFilename, webViewThemes } from "../shared/paths.mjs";

export const mvcModelRequiresViewRuleName = "mvc-model-requires-view";

const modelSuffix = ".model.ts";
const viewSuffix = ".view.tsx";

const isModelFile = (filename) => Fn.pipe(getBasename(filename), Str.endsWith(modelSuffix));

const themeImportsModel = (webRoot, theme, stem) => {
  const themeDir = `${webRoot}/views/${theme}`;
  if (!existsSync(themeDir)) {
    return { missingTheme: true, theme };
  }

  const importSource = `../../models/${stem}.model.ts`;

  const importsModel = Fn.pipe(
    readdirSync(themeDir),
    Arr.some((entry) => {
      if (!Fn.pipe(entry, Str.endsWith(viewSuffix))) {
        return false;
      }

      const source = readFileSync(`${themeDir}/${entry}`, "utf8");
      return source.includes(`from "${importSource}"`) || source.includes(`from '${importSource}'`);
    }),
  );

  return importsModel ? undefined : { missingTheme: false, theme };
};

const missingThemesForModel = (webRoot, stem) =>
  Fn.pipe(
    webViewThemes,
    Arr.map((theme) => themeImportsModel(webRoot, theme, stem)),
    Arr.filter((result) => result !== undefined),
  );

export const mvcModelRequiresView = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require web MVC model files to be imported by at least one view in each registered layout theme.",
    },
    messages: {
      missingThemeDirectory:
        "Model files must be imported by at least one view in the `{{theme}}` theme. Create `src/views/{{theme}}/` and add a view that imports from `../../models/{{stem}}.model.ts`.",
      missingView:
        "Model files must be imported by at least one view in each registered theme. No view under `src/views/{{theme}}/` imports from `../../models/{{stem}}.model.ts`.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isModelFile(filename)) {
      return {};
    }

    const stem = stemFromModelFilename(filename);
    const webRoot = webSrcRootFromFilename(filename);
    const missingThemes = missingThemesForModel(webRoot, stem);

    if (Arr.isReadonlyArrayEmpty(missingThemes)) {
      return {};
    }

    const firstMissing = Fn.pipe(missingThemes, Arr.get(0), Option.getOrThrow);

    return {
      Program(node) {
        context.report({
          node,
          messageId: firstMissing.missingTheme ? "missingThemeDirectory" : "missingView",
          data: { stem, theme: firstMissing.theme },
        });
      },
    };
  },
};
