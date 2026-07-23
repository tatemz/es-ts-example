import { normalizedFilename } from "../shared/context.mjs";
import { webViewPath } from "../shared/paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const viewFilenamingConventionRuleName = "view-filenaming-convention";

export const viewFilenamingConvention = createRule({
  description: "Require web view files to use kebab-case or PascalCase with .view.tsx suffix.",
  messages: {
    invalid: "Web view files must be kebab-case or PascalCase and keep the .view.tsx suffix.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!webViewPath(filename)) {
      return {};
    }

    const basename = filename.replace(/^.*\//, "");
    const stem = basename.replace(/\.view\.tsx$/, "");
    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem);
    const pascal = /^[A-Z][A-Za-z0-9]*$/.test(stem);
    if (kebab || pascal) {
      return {};
    }

    return {
      Program(node) {
        report(context, node, "invalid");
      },
    };
  },
});
