import { packageProductionPath, webSourcePath } from "../shared/paths.mjs";
import { sourceRule } from "../shared/source-rule.mjs";

export const effectFirstCodeRuleName = "effect-first-code";

export const effectFirstCode = sourceRule({
  description: "Require Effect services, typed errors, and schema decoding at boundaries.",
  message:
    "Use Effect services, typed errors, and Effect schema decoding instead of raw runtime APIs or defects.",
  patterns: [
    /\bconsole\./,
    /\bprocess\.env\b/,
    /\bcrypto\.randomUUID\s*\(/,
    /\bthrow\b/,
    /\btry\s*\{/,
    /\bEffect\.orDie\b/,
    /\bSchema\.(?:decodeUnknownSync|decodeSync|encodeUnknownSync|encodeSync)\b/,
    /\b(?:Date|URL|URLSearchParams)\s*\(/,
    /\bnew\s+(?:Date|URL|URLSearchParams)\b/,
    /\bDate\.(?:now|parse|UTC)\s*\(/,
  ],
  // The JSX runtime is the one module that has to speak the host's language.
  shouldRun: (filename) =>
    (packageProductionPath(filename) || webSourcePath(filename)) &&
    !/\/packages\/web\/src\/mvc\/jsx-runtime\.ts$/.test(filename),
});
