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
  shouldRun: (filename) =>
    (packageProductionPath(filename) || webSourcePath(filename)) &&
    !/\/packages\/web\/src\/(?:identityGenerators|mvc\/jsx-runtime)\.ts$/.test(filename) &&
    !/\/packages\/web2\/src\/(?:demo|catalog|server|mvc\/.+)\.ts$/.test(filename) &&
    !/\/packages\/web2\/bin\//.test(filename),
});
