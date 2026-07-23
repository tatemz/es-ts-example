import { normalizedFilename, sourceText } from "./context.mjs";
import { createRule, report } from "./rule.mjs";

export const sourceRule = ({ description, message, patterns, shouldRun = () => true }) =>
  createRule({
    description,
    messages: { invariant: message },
    create(context) {
      if (!shouldRun(normalizedFilename(context))) {
        return {};
      }

      return {
        Program(node) {
          const text = sourceText(context);
          if (patterns.some((pattern) => pattern.test(text))) {
            report(context, node, "invariant");
          }
        },
      };
    },
  });
