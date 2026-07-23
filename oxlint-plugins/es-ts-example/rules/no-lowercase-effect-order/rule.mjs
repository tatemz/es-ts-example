import { staticMemberName, staticMemberRootName } from "../shared/ast.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const noLowercaseEffectOrderRuleName = "no-lowercase-effect-order";

const lowercaseOrderMembers = new Set(["bigint", "boolean", "number", "string"]);

export const noLowercaseEffectOrder = createRule({
  description: "Reject lowercase Effect primitive Order members.",
  messages: {
    invariant: "Use capitalized Effect primitive orders such as Order.String and Order.Number.",
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.computed === false &&
          staticMemberRootName(node.object) === "Order" &&
          lowercaseOrderMembers.has(staticMemberName(node))
        ) {
          report(context, node, "invariant");
        }
      },
    };
  },
});
