import { isRealFilename } from "../shared/filename.mjs";
import {
  webMvcInternalBarrelPath,
  webMvcLayerPattern,
  webMvcSliceInLane,
  webMvcSliceLane,
  webMvcSliceRole,
  webNestedViewPath,
  webSourcePath,
  webUnlayeredViewPath,
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
        "Require web MVC role files to live in their role lane under packages/web/src, split into a pages or controls layer.",
    },
    messages: {
      internalBarrel:
        "Internal MVC barrel files are banned; import concrete model, factory, controller, or view files.",
      wrongPlacement: "Move this {{role}} file into `{{expectedLane}}` with no deeper nesting.",
      unlayeredViewPlacement:
        "Move this view into `src/views/{{layerPattern}}/<Stem>.view.tsx` instead of `src/views/`.",
      unknownViewLayer:
        "Move this view into a known layer folder under `src/views/{{layerPattern}}/`.",
      nestedViewPlacement:
        "Move this view into `src/views/{{layerPattern}}/<Stem>.view.tsx` with no deeper nesting.",
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
      const messageId = webNestedViewPath(filename)
        ? "nestedViewPlacement"
        : webUnlayeredViewPath(filename)
          ? "unlayeredViewPlacement"
          : "unknownViewLayer";

      return {
        Program(node) {
          context.report({
            node,
            messageId,
            data: { layerPattern: webMvcLayerPattern },
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
