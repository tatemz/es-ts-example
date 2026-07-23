import { domainCorePath } from "../shared/paths.mjs";
import { sourceRule } from "../shared/source-rule.mjs";

export const strongTypesRuleName = "strong-types";

export const strongTypes = sourceRule({
  description: "Ban weak type escape hatches and schema shapes.",
  message:
    "Prove values with schemas, tagged matches, and explicit domain types instead of type escapes.",
  patterns: [
    /\bas\s+(?:any|never)\b/,
    /\bas\s+unknown\s+as\b/,
    /[=!]==?\s*[^;\n]*\._tag\b|\._tag\s*[=!]==?/,
    /\bexpect\s*\([^)]*\._tag\b/,
    /\b(?:Option|Either|Result|Exit)\.getOrThrow(?:With)?\b/,
    /\bSchema\.(?:Any|Unknown)\b/,
    /\bSchema\.optional\s*\(/,
  ],
  shouldRun: domainCorePath,
});
