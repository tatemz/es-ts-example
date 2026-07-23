import { normalizedFilename } from "../shared/context.mjs";
import { createRule, report } from "../shared/rule.mjs";
import { webViewPath } from "../shared/paths.mjs";

export const webViewModelStringsRuleName = "web-view-model-strings";

const allowedLiteralAttributes = new Set([
  "action",
  "charset",
  "className",
  "content",
  "crossorigin",
  "d",
  "fill",
  "height",
  "href",
  "id",
  "kind",
  "lang",
  "media",
  "method",
  "name",
  "rel",
  "role",
  "scope",
  "src",
  "stroke",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "tabIndex",
  "target",
  "type",
  "viewBox",
  "width",
  "xmlns",
]);

const allowedAriaLiteralAttributes = new Set([
  "aria-hidden",
  "aria-live",
  "aria-atomic",
  "aria-valuemin",
  "aria-valuemax",
]);

const isPrefixedLiteralAttribute = (name) => /^data-|^hx-/.test(name);

const isAllowedLiteralAttribute = (name) =>
  allowedLiteralAttributes.has(name) ||
  allowedAriaLiteralAttributes.has(name) ||
  isPrefixedLiteralAttribute(name);

const jsxName = (node) => {
  if (node?.type === "JSXIdentifier") {
    return node.name;
  }
  if (node?.type === "JSXNamespacedName") {
    return `${jsxName(node.namespace)}:${jsxName(node.name)}`;
  }
  return undefined;
};

const isStringLiteral = (node) => node?.type === "Literal" && typeof node.value === "string";
const isStringTemplate = (node) => node?.type === "TemplateLiteral";
const isComputedTemplate = (node) => isStringTemplate(node) && node.expressions.length > 0;
const isStringLikeExpression = (node) => isStringLiteral(node) || isStringTemplate(node);

const hasStringLikeOperand = (node) =>
  node.operator === "+" &&
  (isStringLikeExpression(node.left) || isStringLikeExpression(node.right));

const stringLiteralAttribute = (node) =>
  isStringLiteral(node.value) || node.value?.type === "Literal";

export const webViewModelStrings = createRule({
  description: "Require web views to render copy and computed strings from their model.",
  messages: {
    attribute: "View attributes that contain copy must come from the model.",
    binary: "Views must not concatenate strings; move string computation into the model.",
    expression: "View expression text must come from the model.",
    template: "Views must not compute strings; move string computation into the model.",
    text: "View text children must come from the model.",
  },
  create(context) {
    if (!webViewPath(normalizedFilename(context))) {
      return {};
    }

    return {
      BinaryExpression(node) {
        if (hasStringLikeOperand(node)) {
          report(context, node, "binary");
        }
      },
      JSXAttribute(node) {
        const name = jsxName(node.name);
        if (
          name !== undefined &&
          node.value !== null &&
          stringLiteralAttribute(node) &&
          !isAllowedLiteralAttribute(name)
        ) {
          report(context, node, "attribute");
        }
      },
      JSXExpressionContainer(node) {
        if (isStringLikeExpression(node.expression)) {
          report(context, node, "expression");
        }
      },
      JSXText(node) {
        const text = node.value ?? node.raw ?? "";
        if (text.trim() !== "") {
          report(context, node, "text");
        }
      },
      TemplateLiteral(node) {
        if (isComputedTemplate(node)) {
          report(context, node, "template");
        }
      },
    };
  },
});
