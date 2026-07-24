import { staticMemberName } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const renderedDomContractRuleName = "rendered-dom-contract";

const classAttributePattern = /\bclass="/;
const cssTokenPattern =
  /\b(?:absolute|alert|aspect-|backdrop-|badge|bg-|border|btn|card|dropdown|flex|font-|gap-|grid|hidden|inline|items-|join|justify-|leading-|m-|max-|menu|min-|object-|overflow-|p-|place-|relative|rounded|shadow|size-|space-|text-|tracking-|w-|z-)/;

const ratchet = { paths: [], patterns: [] };

const previousExpression = (expression) => {
  if (expression?.type === "CallExpression") {
    return expression.callee;
  }
  if (expression?.type === "MemberExpression") {
    return expression.object;
  }
  if (expression?.type === "ChainExpression") {
    return expression.expression;
  }
  return undefined;
};

const callChainStartsWithExpect = (expression) =>
  expression?.type === "Identifier" && expression.name === "expect"
    ? true
    : previousExpression(expression) !== undefined &&
      callChainStartsWithExpect(previousExpression(expression));

const isContainExpectation = (node) =>
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  staticMemberName(node.callee) === "toContain" &&
  callChainStartsWithExpect(node.callee.object);

const stringArgument = (node) => {
  const first = node.arguments[0];
  if (first?.type === "Literal" && typeof first.value === "string") {
    return first.value;
  }
  if (first?.type === "TemplateLiteral" && first.expressions.length === 0) {
    return first.quasis[0]?.value.cooked ?? first.quasis[0]?.value.raw;
  }
  return undefined;
};

const tokenCount = (value) =>
  value.split(/\s+/).filter((part) => cssTokenPattern.test(part)).length;

const isBrittleRenderedContract = (value) =>
  classAttributePattern.test(value) ||
  tokenCount(value) >= 3 ||
  /\b(?:card card-|btn btn-|badge badge-|alert alert-|dropdown dropdown-|menu dropdown-)/.test(
    value,
  );

const shouldRun = (filename) =>
  /\/packages\/web\/test\/.*\.tsx?$/.test(filename) && !pathAllowedByPolicy(filename, ratchet);

export const renderedDomContract = createRule({
  description: "Reject brittle rendered DOM class-string contracts.",
  messages: {
    brittle:
      "Assert stable DOM contracts instead of brittle Tailwind or daisyUI class-string snapshots.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!shouldRun(filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        const value = stringArgument(node);
        if (isContainExpectation(node) && value !== undefined && isBrittleRenderedContract(value)) {
          report(context, node, "brittle");
        }
      },
    };
  },
});
