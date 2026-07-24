import { normalizedFilename, sourceText } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const testFixtureBoundariesRuleName = "test-fixture-boundaries";

const ratchet = {
  paths: [
    "packages/application/test/unit/index.test.ts",
    "packages/web/test/unit/web-infrastructure.test.ts",
  ],
};

const unitTestPattern = /\/packages\/[^/]+\/test\/unit\/.*\.test\.tsx?$/;
const testFilePattern = /\/(?:packages\/[^/]+\/test|test)\/.*\.tsx?$/;
const demoSourceImportPattern =
  /from\s+["'][^"']*(?:^|\/)src\/(?:demo|.*-demo|party\/party-demo)(?:\.ts)?["']/;
const mutationSentinelPattern = /\b(?:Stryker was here|Mutation sentinel|noCover[A-Z0-9_])/;

const shouldRun = (filename) =>
  testFilePattern.test(filename) && !pathAllowedByPolicy(filename, ratchet);

export const testFixtureBoundaries = createRule({
  description: "Keep unit tests off runtime demo fixtures and shared mutation sentinels.",
  messages: {
    demoImport: "Unit tests must not import runtime demo or seed modules; use test-owned fixtures.",
    sentinel:
      "Mutation sentinel data must live in focused mutation-contract tests, not shared fixtures.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!shouldRun(filename)) {
      return {};
    }

    return {
      Program(node) {
        const text = sourceText(context);
        if (unitTestPattern.test(filename) && demoSourceImportPattern.test(text)) {
          report(context, node, "demoImport");
        }
        if (mutationSentinelPattern.test(text)) {
          report(context, node, "sentinel");
        }
      },
    };
  },
});
