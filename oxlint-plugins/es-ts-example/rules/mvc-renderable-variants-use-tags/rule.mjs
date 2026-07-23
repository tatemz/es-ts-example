import { normalizedFilename } from "../shared/context.mjs";
import { staticMemberName, staticMemberRootName } from "../shared/ast.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const mvcRenderableVariantsUseTagsRuleName = "mvc-renderable-variants-use-tags";

const selectorNames = new Set(["layout", "template", "variant"]);
const selectorOwners = new Set(["input", "model"]);

const isMvcRenderableFilename = (filename) =>
  /\/packages\/web\/src\/.*\.(?:model|factory|view)\.tsx?$/.test(filename);

const isFactoryFilename = (filename) => /\.factory\.ts$/.test(filename);

const isModelFilename = (filename) => /\.model\.ts$/.test(filename);

const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }

  return node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
};

const isSelectorName = (name) => name !== undefined && selectorNames.has(name);

const isStringLiteral = (node) => node?.type === "Literal" && typeof node.value === "string";

const stringLiteralCount = (nodes) =>
  nodes.filter((node) => node !== null && node !== undefined && isStringLiteral(node)).length;

const expressionForArrayArgument = (node) =>
  node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression"
    ? node.expression
    : node;

const arrayStringLiteralCount = (node) => {
  const expression = expressionForArrayArgument(node);
  return expression?.type === "ArrayExpression" ? stringLiteralCount(expression.elements) : 0;
};

const schemaLiteralMemberCount = (node) => {
  if (node?.type !== "CallExpression" || node.callee?.type !== "MemberExpression") {
    return 0;
  }

  const root = staticMemberRootName(node.callee.object);
  const member = staticMemberName(node.callee);
  if (root !== "Schema") {
    return 0;
  }

  if (member === "Literals") {
    return Math.max(stringLiteralCount(node.arguments), arrayStringLiteralCount(node.arguments[0]));
  }

  if (member === "Literal") {
    return stringLiteralCount(node.arguments);
  }

  if (member !== "Union") {
    return 0;
  }

  const unionMembers =
    node.arguments.length === 1 &&
    expressionForArrayArgument(node.arguments[0])?.type === "ArrayExpression"
      ? expressionForArrayArgument(node.arguments[0]).elements
      : node.arguments;

  return unionMembers.reduce(
    (count, memberNode) => count + schemaLiteralMemberCount(memberNode),
    0,
  );
};

const typeStringLiteralCount = (node) => {
  if (node?.type !== "TSUnionType") {
    return 0;
  }

  return node.types.filter((type) => type.type === "TSLiteralType" && isStringLiteral(type.literal))
    .length;
};

const selectorMemberName = (node) => {
  if (
    node?.type !== "MemberExpression" ||
    node.computed !== false ||
    node.object.type !== "Identifier" ||
    !selectorOwners.has(node.object.name)
  ) {
    return undefined;
  }

  const name = propertyName(node.property);
  return isSelectorName(name) ? name : undefined;
};

const isSelectorComparison = (node) =>
  node.type === "BinaryExpression" &&
  ["==", "===", "!=", "!=="].includes(node.operator) &&
  ((selectorMemberName(node.left) !== undefined && isStringLiteral(node.right)) ||
    (selectorMemberName(node.right) !== undefined && isStringLiteral(node.left)));

const isMatchValueSelectorCall = (node) =>
  node.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  staticMemberRootName(node.callee.object) === "Match" &&
  staticMemberName(node.callee) === "value" &&
  selectorMemberName(node.arguments[0]) !== undefined;

export const mvcRenderableVariantsUseTags = createRule({
  description: "Require renderable MVC variants to be represented by tagged models.",
  messages: {
    modelSelector:
      "Renderable variants must use separate tagged models, not a `{{fieldName}}` string selector field.",
    factorySelector:
      "Factory inputs must choose renderable variants by constructing the right tagged model, not with a `{{fieldName}}` string selector.",
    selectorBranch:
      "Dispatch renderable variants with `Match.typeTags` over a model union instead of branching on a selector field.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!isMvcRenderableFilename(filename)) {
      return {};
    }

    return {
      Property(node) {
        const name = propertyName(node.key);
        if (
          isModelFilename(filename) &&
          isSelectorName(name) &&
          schemaLiteralMemberCount(node.value) >= 2
        ) {
          context.report({ node, messageId: "modelSelector", data: { fieldName: name } });
        }
      },
      TSPropertySignature(node) {
        const name = propertyName(node.key);
        const annotation = node.typeAnnotation?.typeAnnotation;
        if (
          isFactoryFilename(filename) &&
          isSelectorName(name) &&
          typeStringLiteralCount(annotation) >= 2
        ) {
          context.report({ node, messageId: "factorySelector", data: { fieldName: name } });
        }
      },
      BinaryExpression(node) {
        if (isSelectorComparison(node)) {
          report(context, node, "selectorBranch");
        }
      },
      CallExpression(node) {
        if (isMatchValueSelectorCall(node)) {
          report(context, node, "selectorBranch");
        }
      },
    };
  },
});
