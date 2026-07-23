import { normalizedFilename, sourceText } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const publicEntrypointPolicyRuleName = "public-entrypoint-policy";

const publicEntrypointPattern = /\/packages\/[^/]+\/src\/index\.ts$/;
const seedExportPattern = /export\s+.*from\s+["'][^"']*(?:Seed|seed)[^"']*["']/;
const exportStatementPattern = /^export\s/gm;
const maxPublicExportStatements = 50;
const sizeRatchet = { paths: ["packages/web/src/index.ts"] };

export const publicEntrypointPolicy = createRule({
  description: "Keep package public entrypoints small and free of seed exports.",
  messages: {
    seedExport: "Public entrypoints must not re-export seed/demo fixtures.",
    tooManyExports:
      "Public entrypoint has more than 50 export statements; split it into smaller subpath entrypoints.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!publicEntrypointPattern.test(filename)) {
      return {};
    }

    return {
      Program(node) {
        const text = sourceText(context);
        if (seedExportPattern.test(text)) {
          report(context, node, "seedExport");
        }

        const exportCount = [...text.matchAll(exportStatementPattern)].length;
        if (
          exportCount > maxPublicExportStatements &&
          !pathAllowedByPolicy(filename, sizeRatchet)
        ) {
          report(context, node, "tooManyExports");
        }
      },
    };
  },
});
