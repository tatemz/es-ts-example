import { isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { isFactoryFilename } from "../shared/mvc-ownership.mjs";

export const mvcFactoryUserFacingStringsUseI18nRuleName =
  "mvc-factory-user-facing-strings-use-i18n";

const userFacingPropertyPattern =
  /(?:Action|AriaLabel|Badge|Description|Detail|DocumentTitle|ErrorMessage|Heading|Initials|Label|Metadata|Question|Title|Wordmark|badge|description|detail|documentTitle|errorMessage|heading|initials|label|metadata|question|title|wordmark)$/;

const propertyName = (node) =>
  node.computed
    ? undefined
    : node.key.type === "Identifier"
      ? node.key.name
      : typeof node.key.value === "string"
        ? node.key.value
        : undefined;

const isHardcodedString = (node) =>
  (node.type === "Literal" && typeof node.value === "string") || node.type === "TemplateLiteral";

export const mvcFactoryUserFacingStringsUseI18n = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require user-facing strings in web model factories to come from keyed i18n messages.",
    },
    messages: {
      hardcoded:
        "User-facing factory property `{{property}}` must be calculated from a keyed i18n message.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isFactoryFilename(filename)) {
      return {};
    }

    return {
      Property(node) {
        const name = propertyName(node);
        if (
          name !== undefined &&
          userFacingPropertyPattern.test(name) &&
          isHardcodedString(node.value)
        ) {
          context.report({
            node: node.value,
            messageId: "hardcoded",
            data: { property: name },
          });
        }
      },
    };
  },
};
