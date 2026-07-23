import { hasObjectProperties, isStaticCall } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { packageProductionPath } from "../shared/paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const effectTryPromiseRequiresCatchRuleName = "effect-trypromise-requires-catch";

export const effectTryPromiseRequiresCatch = createRule({
  description: "Require Effect.tryPromise object form with explicit error mapping.",
  messages: {
    invariant:
      "Use Effect.tryPromise({ try, catch }) so foreign promise failures are mapped deterministically.",
  },
  create(context) {
    if (!packageProductionPath(normalizedFilename(context))) {
      return {};
    }

    return {
      CallExpression(node) {
        if (
          isStaticCall(node, "Effect", "tryPromise") &&
          !hasObjectProperties(node.arguments[0], ["try", "catch"])
        ) {
          report(context, node, "invariant");
        }
      },
    };
  },
});
