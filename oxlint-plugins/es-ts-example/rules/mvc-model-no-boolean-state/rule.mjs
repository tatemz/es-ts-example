import { staticMemberName, staticMemberRootName } from "../shared/ast.mjs";
import { isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { isModelFilename } from "../shared/mvc-ownership.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const mvcModelNoBooleanStateRuleName = "mvc-model-no-boolean-state";

const isSchemaBoolean = (node) =>
  node?.type === "MemberExpression" &&
  node.computed === false &&
  staticMemberRootName(node) === "Schema" &&
  staticMemberName(node) === "Boolean";

export const mvcModelNoBooleanState = createRule({
  description:
    "Reject direct Schema.Boolean fields in web MVC models; use private tagged unions for stateful presentation.",
  messages: {
    booleanField:
      "Model fields must not use `Schema.Boolean`. Model stateful presentation belongs in private tagged unions constructed by factories. Independently optional child composition may use `Schema.optionalKey` with a child model.",
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isModelFilename(filename)) {
      return {};
    }

    return {
      Property(node) {
        if (isSchemaBoolean(node.value)) {
          report(context, node, "booleanField");
        }
      },
    };
  },
});
