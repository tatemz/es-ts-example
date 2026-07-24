import { staticMemberName, walkAst } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule } from "../shared/rule.mjs";
import { testPath } from "../shared/paths.mjs";

export const testAssertionQualityRuleName = "test-assertion-quality";

const weakMatchers = new Set(["toBeDefined", "toBeFalsy", "toBeTruthy"]);

const ratchet = {
  paths: [
    "packages/application/test/unit/counter.test.ts",
    "packages/application/test/unit/index.test.ts",
    "packages/domain/test/unit/counter.test.ts",
    "packages/test-support/test/unit/index.test.ts",
  ],
  patterns: [/^packages\/(?:application|domain|web)\/test\/e2e\/steps\/.+\.steps\.ts$/],
};

const isIdentifier = (node, name) => node?.type === "Identifier" && node.name === name;

const previousExpression = (expression) => {
  if (expression?.type === "CallExpression") {
    return expression.callee;
  }
  if (expression?.type === "MemberExpression") {
    return expression.object;
  }
  if (
    expression?.type === "ChainExpression" ||
    expression?.type === "TSAsExpression" ||
    expression?.type === "TSSatisfiesExpression" ||
    expression?.type === "TSNonNullExpression"
  ) {
    return expression.expression;
  }
  return undefined;
};

const chainStartsWithExpect = (expression) =>
  isIdentifier(expression, "expect") ||
  (previousExpression(expression) !== undefined &&
    chainStartsWithExpect(previousExpression(expression)));

const matcherName = (node) =>
  node.callee?.type === "MemberExpression" && node.callee.computed === false
    ? staticMemberName(node.callee)
    : undefined;

const isExpectMatcherCall = (node) =>
  node.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  chainStartsWithExpect(node.callee.object);

const isBareToThrow = (node, name) => name === "toThrow" && node.arguments.length === 0;

const isAssertMemberCall = (node) =>
  node.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  isIdentifier(node.callee.object, "assert");

const isSupportAssertionCall = (node) =>
  node.type === "CallExpression" &&
  node.callee?.type === "Identifier" &&
  /^assert[A-Z0-9]/.test(node.callee.name);

const isFastCheckAssertCall = (node) =>
  node.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  isIdentifier(node.callee.object, "FastCheck") &&
  staticMemberName(node.callee) === "assert";

const isUsefulExpectCall = (node) => {
  const name = matcherName(node);
  return (
    name !== undefined &&
    isExpectMatcherCall(node) &&
    !weakMatchers.has(name) &&
    !isBareToThrow(node, name)
  );
};

const isUsefulAssertionCall = (node) =>
  isUsefulExpectCall(node) ||
  isAssertMemberCall(node) ||
  isSupportAssertionCall(node) ||
  isFastCheckAssertCall(node);

const callbackBodyFromArgument = (argument) =>
  argument?.type === "ArrowFunctionExpression" || argument?.type === "FunctionExpression"
    ? argument.body
    : undefined;

const testCallbackBody = (node) => callbackBodyFromArgument(node.arguments[1]);

const testNameText = (node) =>
  node.arguments[0]?.type === "Literal" && typeof node.arguments[0].value === "string"
    ? node.arguments[0].value
    : "<dynamic test name>";

const templateText = (template) =>
  template?.type === "TemplateLiteral"
    ? template.quasis.map((quasi) => quasi.value.raw).join("${...}")
    : "";

const thenStepDetails = (node) => {
  const tagged = node.callee;
  if (
    tagged?.type !== "TaggedTemplateExpression" ||
    tagged.tag?.type !== "MemberExpression" ||
    staticMemberName(tagged.tag) !== "then"
  ) {
    return undefined;
  }

  const body = callbackBodyFromArgument(node.arguments[0]);
  return body === undefined ? undefined : { body, name: templateText(tagged.quasi) };
};

const testDetails = (node) => {
  const name = node.callee?.type === "Identifier" ? node.callee.name : undefined;
  if (name !== "test" && name !== "testEffect") {
    return thenStepDetails(node);
  }

  const body = testCallbackBody(node);
  return body === undefined ? undefined : { body, name: testNameText(node) };
};

const hasUsefulAssertion = (node) => {
  let found = false;
  walkAst(node, (child) => {
    if (child.type === "CallExpression" && isUsefulAssertionCall(child)) {
      found = true;
    }
  });
  return found;
};

const shouldRun = (filename) =>
  testPath(filename) && /\.(?:ts|tsx)$/.test(filename) && !pathAllowedByPolicy(filename, ratchet);

export const testAssertionQuality = createRule({
  description: "Require exact useful assertions in tests.",
  messages: {
    bareThrow: "Replace bare toThrow() with an expected error contract.",
    missingAssertion: 'Test "{{testName}}" has no useful assertion boundary.',
    weakMatcher: "Replace weak matcher {{matcherName}} with an exact behavioral assertion.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!shouldRun(filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        const name = matcherName(node);
        if (name !== undefined && isExpectMatcherCall(node)) {
          if (weakMatchers.has(name)) {
            context.report({ node, messageId: "weakMatcher", data: { matcherName: name } });
          }
          if (isBareToThrow(node, name)) {
            context.report({ node, messageId: "bareThrow" });
          }
        }

        const details = testDetails(node);
        if (details !== undefined && !hasUsefulAssertion(details.body)) {
          context.report({
            node,
            messageId: "missingAssertion",
            data: { testName: details.name },
          });
        }
      },
    };
  },
});
