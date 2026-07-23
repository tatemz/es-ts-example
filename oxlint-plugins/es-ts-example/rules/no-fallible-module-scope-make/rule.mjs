import { staticMemberName, staticMemberRootName, walkTopLevelExpression } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { packageSourcePath } from "../shared/paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const noFallibleModuleScopeMakeRuleName = "no-fallible-module-scope-make";

const fallibleMakeAllowlist = new Set(["Arr", "I18n", "Layer", "Rpc", "RpcGroup"]);

export const noFallibleModuleScopeMake = createRule({
  description: "Reject module-scope schema/domain constructor make calls.",
  messages: {
    invariant:
      "Move fallible .make(...) construction behind an executable boundary instead of running it at module import.",
  },
  create(context) {
    if (!packageSourcePath(normalizedFilename(context))) {
      return {};
    }

    return {
      Program(node) {
        for (const statement of node.body) {
          walkTopLevelExpression(statement, (child) => {
            if (
              child.type === "CallExpression" &&
              child.callee?.type === "MemberExpression" &&
              child.callee.computed === false &&
              staticMemberName(child.callee) === "make" &&
              !fallibleMakeAllowlist.has(staticMemberRootName(child.callee.object))
            ) {
              report(context, child, "invariant");
            }
          });
        }
      },
    };
  },
});
