import { walkAst } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { createRule } from "../shared/rule.mjs";

export const i18nMessageCatalogsRuleName = "i18n-message-catalogs";

const propertyStringKey = (node) =>
  node?.type === "Property" && node.key?.type === "Literal" && typeof node.key.value === "string"
    ? node.key.value
    : undefined;

export const i18nMessageCatalogs = createRule({
  description: "Keep i18n message catalogs duplicate-free within each file.",
  messages: {
    duplicate: "Message id {{id}} is defined more than once in this catalog file.",
  },
  create(context) {
    if (!/\/packages\/web\/src\/.*\.messages\.ts$/.test(normalizedFilename(context))) {
      return {};
    }

    return {
      Program(node) {
        const seen = new Set();
        const reported = new Set();
        walkAst(node, (child) => {
          const id = propertyStringKey(child);
          if (id === undefined || !seen.has(id) || reported.has(id)) {
            if (id !== undefined) {
              seen.add(id);
            }
            return;
          }

          reported.add(id);
          context.report({ node: child, messageId: "duplicate", data: { id } });
        });
      },
    };
  },
});
