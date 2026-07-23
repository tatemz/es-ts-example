import { staticMemberName, staticMemberRootName, walkAst } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { createRule } from "../shared/rule.mjs";

export const literalUnionOwnershipRuleName = "literal-union-ownership";

const isSchemaCall = (node, member) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  staticMemberRootName(node.callee.object) === "Schema" &&
  staticMemberName(node.callee) === member;

const literalMembers = (node) => {
  const members = [];
  walkAst(node, (child) => {
    if (isSchemaCall(child, "Literal")) {
      for (const argument of child.arguments) {
        if (argument?.type === "Literal" && typeof argument.value === "string") {
          members.push(argument.value);
        }
      }
    }
  });
  return members;
};

const siteMembers = (node) => {
  if (isSchemaCall(node, "Union")) {
    return literalMembers(node);
  }
  if (isSchemaCall(node, "Literal")) {
    return node.arguments
      .filter((argument) => argument?.type === "Literal" && typeof argument.value === "string")
      .map((argument) => argument.value);
  }
  return [];
};

const keyForMembers = (members) => [...new Set(members)].sort().join("|");

export const literalUnionOwnership = createRule({
  description: "Keep duplicate literal unions out of local source files.",
  messages: {
    duplicate:
      "Duplicate literal union members are already defined in this file; define the schema once and reuse it.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!/\/packages\/(?:domain|application)\/src\/.*\.ts$/.test(filename)) {
      return {};
    }
    const literalUnionKeys = new Set();

    return {
      CallExpression(node) {
        const members = siteMembers(node);
        if (members.length < 2) {
          return;
        }

        const key = keyForMembers(members);
        if (literalUnionKeys.has(key)) {
          context.report({ node, messageId: "duplicate" });
          return;
        }
        literalUnionKeys.add(key);
      },
    };
  },
});
