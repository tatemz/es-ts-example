import { staticMemberName, walkAst } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule } from "../shared/rule.mjs";

export const testAssertionBoundariesRuleName = "test-assertion-boundaries";

/**
 * Files written before the one-assertion-boundary rule existed. The list only
 * shrinks: a new test must group its expectations into a single boundary.
 */
const ratchet = {
  paths: [
    "packages/application/test/unit/counter.test.ts",
    "packages/application/test/unit/index.test.ts",
    "packages/domain/test/unit/counter.test.ts",
    "packages/event-sourcing/test/unit/index.test.ts",
    "packages/event-sourcing/test/unit/projection.test.ts",
    "packages/test-support/test/unit/index.test.ts",
    "packages/web/test/unit/html.test.ts",
    "packages/web/test/unit/web-infrastructure.test.ts",
  ],
  patterns: [],
};

const isIdentifier = (node, name) => node?.type === "Identifier" && node.name === name;

const isAssertMemberCall = (node) =>
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  isIdentifier(node.callee.object, "assert");

const isBoundaryCall = (node) =>
  (node.callee?.type === "Identifier" &&
    (node.callee.name === "expect" || /^assert[A-Z0-9]/.test(node.callee.name))) ||
  isAssertMemberCall(node);

const isFastCheckAssertCall = (node) =>
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  isIdentifier(node.callee.object, "FastCheck") &&
  staticMemberName(node.callee) === "assert";

const callbackBodyFromArgument = (argument) =>
  argument?.type === "ArrowFunctionExpression" || argument?.type === "FunctionExpression"
    ? argument.body
    : undefined;

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

  const body = callbackBodyFromArgument(node.arguments[1]);
  return body === undefined ? undefined : { body, name: testNameText(node) };
};

const assertionBoundaryCount = (node) => {
  let count = 0;
  let containsFastCheckAssert = false;
  walkAst(node, (child) => {
    if (child.type !== "CallExpression") {
      return;
    }
    if (isFastCheckAssertCall(child)) {
      containsFastCheckAssert = true;
    }
    if (isBoundaryCall(child)) {
      count += 1;
    }
  });
  return containsFastCheckAssert ? 0 : count;
};

const shouldRun = (filename) =>
  /\/packages\/[^/]+\/test\/.*\.(?:test|e2e|steps)\.ts$/.test(filename) &&
  !pathAllowedByPolicy(filename, ratchet);

export const testAssertionBoundaries = createRule({
  description: "Require each test body to use one assertion boundary.",
  messages: {
    tooMany: '{{count}} assertion boundaries in "{{testName}}".',
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!shouldRun(filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        const details = testDetails(node);
        const count = details === undefined ? 0 : assertionBoundaryCount(details.body);
        if (details !== undefined && count > 1) {
          context.report({
            node,
            messageId: "tooMany",
            data: { count: String(count), testName: details.name },
          });
        }
      },
    };
  },
});
