import {
  isFunctionLike,
  isStaticCall,
  staticMemberName,
  staticMemberRootName,
  walkExpression,
} from "../shared/ast.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const noOptionReturningFilterMapRuleName = "no-option-returning-filter-map";

const containsOptionSomeNone = (node) => {
  let found = false;
  walkExpression(node, (child) => {
    if (
      child.type === "MemberExpression" &&
      child.computed === false &&
      staticMemberRootName(child.object) === "Option" &&
      (staticMemberName(child) === "some" || staticMemberName(child) === "none")
    ) {
      found = true;
    }
  });
  return found;
};

export const noOptionReturningFilterMap = createRule({
  description: "Reject Effect v3 Option-returning Arr.filterMap callbacks.",
  messages: {
    invariant:
      "Arr.filterMap expects Result values in Effect v4; use Arr.filter plus Arr.map, or return Result values.",
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isStaticCall(node, "Arr", "filterMap")) {
          return;
        }

        const callback = node.arguments.find(isFunctionLike);
        if (callback !== undefined && containsOptionSomeNone(callback.body)) {
          report(context, node, "invariant");
        }
      },
    };
  },
});
