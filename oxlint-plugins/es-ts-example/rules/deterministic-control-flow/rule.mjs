import { packageProductionPath, webSourcePath } from "../shared/paths.mjs";
import { sourceRule } from "../shared/source-rule.mjs";

export const deterministicControlFlowRuleName = "deterministic-control-flow";

export const deterministicControlFlow = sourceRule({
  description: "Prefer deterministic Effect and immutable data flow.",
  message:
    "Use immutable Effect-oriented data flow instead of mutable or branch-heavy control flow.",
  patterns: [
    /\bswitch\s*\(/,
    /\bfor\s*(?:await\s*)?\(/,
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\([^)]*=[^)]*\)/,
    /\bMatch\.(?:orElse|orElseAbsurd|option)\b/,
  ],
  shouldRun: (filename) => packageProductionPath(filename) && !webSourcePath(filename),
});
