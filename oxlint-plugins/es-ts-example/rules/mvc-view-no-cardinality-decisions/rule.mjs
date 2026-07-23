import { isLengthMember, isStaticCall, walkAst } from "../shared/ast.mjs";
import { isRealFilename } from "../shared/filename.mjs";
import { isViewFilename } from "../shared/mvc-ownership.mjs";
import { webViewPath, webEsTsExampleRenderablePath } from "../shared/paths.mjs";
import { createRule } from "../shared/rule.mjs";

export const mvcViewNoCardinalityDecisionsRuleName = "mvc-view-no-cardinality-decisions";

const cardinalityComparisonOperators = new Set(["===", "!==", "==", "!=", ">", ">=", "<", "<="]);

const isZeroLiteral = (node) => node?.type === "Literal" && node.value === 0;

const isLengthCardinalityComparison = (node) => {
  if (node.type !== "BinaryExpression" || !cardinalityComparisonOperators.has(node.operator)) {
    return false;
  }

  return (
    (isLengthMember(node.left) && isZeroLiteral(node.right)) ||
    (isLengthMember(node.right) && isZeroLiteral(node.left))
  );
};

const isNegatedLengthCardinality = (node) =>
  node.type === "UnaryExpression" && node.operator === "!" && isLengthMember(node.argument);

const isArrayCardinalityCall = (node) =>
  isStaticCall(node, "Arr", "isReadonlyArrayEmpty") ||
  isStaticCall(node, "Arr", "isReadonlyArrayNonEmpty");

const isCardinalityDecision = (node) =>
  isArrayCardinalityCall(node) ||
  isLengthCardinalityComparison(node) ||
  isNegatedLengthCardinality(node);

export const mvcViewNoCardinalityDecisions = createRule({
  description:
    "Keep array cardinality decisions in factories; views render tagged empty or populated presentation unions.",
  messages: {
    cardinalityDecision:
      "Views must not branch on array cardinality. Emit a tagged empty or populated presentation union from the factory with `Schema.NonEmptyArray` for populated variants.",
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (
      !isRealFilename(filename) ||
      !isViewFilename(filename) ||
      !webViewPath(filename) ||
      webEsTsExampleRenderablePath(filename)
    ) {
      return {};
    }

    return {
      Program(node) {
        walkAst(node, (visited) => {
          if (isCardinalityDecision(visited)) {
            context.report({ node: visited, messageId: "cardinalityDecision" });
          }
        });
      },
    };
  },
});
