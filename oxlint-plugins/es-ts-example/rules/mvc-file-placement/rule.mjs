import { isRealFilename } from "../shared/filename.mjs";
import {
  webDirectViewPath,
  webMvcInternalBarrelPath,
  webMvcSliceInLane,
  webMvcSliceLane,
  webMvcSliceRole,
  webNestedThemeViewPath,
  webSourcePath,
  webUnknownThemeViewPath,
  webViewThemePattern,
} from "../shared/paths.mjs";

export const mvcFilePlacementRuleName = "mvc-file-placement";

const roleLabel = {
  models: "model",
  factories: "factory",
  views: "view",
  controllers: "controller",
};

export const mvcFilePlacement = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require web MVC role files to live directly in their role lanes under packages/web/src, with themed views in registered layout folders.",
    },
    messages: {
      internalBarrel:
        "Internal MVC barrel files are banned; import concrete model, factory, controller, or view files.",
      wrongPlacement: "Move this {{role}} file into `{{expectedLane}}` with no nested folders.",
      directViewPlacement:
        "Move this view into `src/views/{{themePattern}}/<Stem>.view.tsx` instead of `src/views/`.",
      unknownViewTheme:
        "Move this view into a registered layout theme folder under `src/views/{{themePattern}}/`.",
      nestedViewPlacement:
        "Move this view into `src/views/{{themePattern}}/<Stem>.view.tsx` with no deeper nesting.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !webSourcePath(filename)) {
      return {};
    }

    if (webMvcInternalBarrelPath(filename)) {
      return {
        Program(node) {
          context.report({ node, messageId: "internalBarrel" });
        },
      };
    }

    const role = webMvcSliceRole(filename);
    if (role === undefined || webMvcSliceInLane(filename)) {
      return {};
    }

    if (role === "views") {
      const themePattern = webViewThemePattern;
      const messageId = webNestedThemeViewPath(filename)
        ? "nestedViewPlacement"
        : webUnknownThemeViewPath(filename)
          ? "unknownViewTheme"
          : webDirectViewPath(filename)
            ? "directViewPlacement"
            : "unknownViewTheme";

      return {
        Program(node) {
          context.report({
            node,
            messageId,
            data: { themePattern },
          });
        },
      };
    }

    const expectedLane = webMvcSliceLane(role);

    return {
      Program(node) {
        context.report({
          node,
          messageId: "wrongPlacement",
          data: { role: roleLabel[role], expectedLane },
        });
      },
    };
  },
};
