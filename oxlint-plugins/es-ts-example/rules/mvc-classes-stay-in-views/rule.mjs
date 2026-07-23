import { normalizedFilename } from "../shared/context.mjs";
import { createRule } from "../shared/rule.mjs";

export const mvcClassesStayInViewsRuleName = "mvc-classes-stay-in-views";

const isMvcModelOrFactoryFilename = (filename) =>
  /\/packages\/web\/src\/.*\.(?:model|factory)\.ts$/.test(filename);

const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }

  return node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
};

const isClassNameField = (name) =>
  name === "className" || (typeof name === "string" && /ClassName$/.test(name));

export const mvcClassesStayInViews = createRule({
  description: "Keep CSS class names out of MVC models and factories.",
  messages: {
    classNameField:
      "MVC models and factories must carry semantic state, not CSS class field `{{fieldName}}`; compute classes in the view.",
  },
  create(context) {
    if (!isMvcModelOrFactoryFilename(normalizedFilename(context))) {
      return {};
    }

    const reportClassNameField = (node) => {
      const fieldName = propertyName(node.key);
      if (isClassNameField(fieldName)) {
        context.report({ node, messageId: "classNameField", data: { fieldName } });
      }
    };

    return {
      Property: reportClassNameField,
      TSPropertySignature: reportClassNameField,
    };
  },
});
