import Path from "node:path";
import { normalizedFilename } from "../shared/context.mjs";
import { relativeFilename } from "../shared/policy-paths.mjs";
import { createRule } from "../shared/rule.mjs";

export const repoPathPolicyRuleName = "repo-path-policy";

const parentSegment = "..";

const literalValue = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
};

const escapesRepo = (filePath, value) => {
  if (!value.startsWith(parentSegment)) {
    return false;
  }

  const resolved = Path.posix.normalize(
    `${Path.posix.dirname(relativeFilename(filePath))}/${value}`,
  );
  return resolved === ".." || resolved.startsWith("../");
};

const reportIfEscaping = (context, filename, node) => {
  const value = literalValue(node);
  if (value !== undefined && escapesRepo(filename, value)) {
    context.report({ node, messageId: "escape" });
  }
};

export const repoPathPolicy = createRule({
  description: "Prevent TypeScript path literals from escaping the repository.",
  messages: {
    escape:
      "Relative paths must not escape the repository unless they are named policy exceptions.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!/\.(?:ts|tsx)$/.test(filename)) {
      return {};
    }

    return {
      Literal(node) {
        reportIfEscaping(context, filename, node);
      },
      TemplateLiteral(node) {
        reportIfEscaping(context, filename, node);
      },
    };
  },
});
