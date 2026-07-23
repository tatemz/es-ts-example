import { webMvcUiArchitecturePath } from "../shared/paths.mjs";
import { sourceRule } from "../shared/source-rule.mjs";

export const mvcUiArchitectureRuleName = "mvc-ui-architecture";

export const mvcUiArchitecture = sourceRule({
  description: "Keep MVC and UI ownership boundaries explicit.",
  message:
    "Keep MVC models, factories, controllers, views, routes, and UI primitives in their lanes.",
  patterns: [
    /\b(?:export\s+)?const\s+\w+\s*=\s*async\s*\(/,
    /\basync\s+function\s+\w+/,
    /\byield\*\s+/,
    /<(?:(?:form|button|input|select|textarea)\b)/,
  ],
  shouldRun: webMvcUiArchitecturePath,
});
