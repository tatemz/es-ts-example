import { packageProductionPath, webSourcePath } from "../shared/paths.mjs";
import { normalizedFilename, sourceText } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const importRuntimeBoundariesRuleName = "import-runtime-boundaries";

const runtimeBoundaryPatterns = [
  /from\s+["'](?:fs|fs\/promises|node:fs|node:fs\/promises)["']/,
  /from\s+["'](?:effect\/Config|effect\/ConfigProvider)["']/,
  /["'`]https:\/\/(?:picsum\.photos|media\.es-ts-example\.local)/,
  /["'`](?:\/|#[A-Za-z0-9_-]*[g-zG-Z][A-Za-z0-9_-]*)/,
  /\bpathname\b|\brequest\.url\b|\bUrl\.fromString\s*\(/,
  /\bBun\.(?:env|file|spawn|spawnSync)\b/,
];

const runtimeTestSupportRatchet = {
  paths: [
    "packages/application/bin/main.ts",
    "packages/cli/bin/main.ts",
    "packages/event-sourcing/bin/main.ts",
    "packages/scratchpad/bin/main.ts",
  ],
};

const testSupportImportPattern =
  /from\s+["'](?:@es-ts-example\/test-support|[^"']*packages\/test-support|[^"']*\/test-support\/src)/;
const productionRuntimePattern = /\/packages\/(?!test-support\/)[^/]+\/(?:src|bin)\/.*\.tsx?$/;
const productionSeedBoundaryPattern =
  /\/packages\/[^/]+\/src\/.*(?:controller|server|rpc)[^/]*\.(?:ts|tsx)$/;
const seedImportPattern = /from\s+["'][^"']*(?:Seed|seed|Fixture|fixture)[^"']*["']/;

const shouldRunRuntimeBoundary = (filename) =>
  (packageProductionPath(filename) || webSourcePath(filename)) &&
  !/\/packages\/cli\/bin\//.test(filename) &&
  !/\/packages\/application\/src\/readModels\/media\.ts$/.test(filename) &&
  !/\/packages\/web\/src\/(?:routes|server|identityGenerators|mvc\/jsx-runtime)\.ts$/.test(
    filename,
  ) &&
  !/\/packages\/web\/bin\//.test(filename) &&
  !/\/packages\/web2\/src\/(?:paths|server|demo|catalog|mvc\/.+)\.ts$/.test(filename) &&
  !/\/packages\/web2\/src\/create\/(?:draftStore|guidedCreate\.routes)\.ts$/.test(filename) &&
  !/\/packages\/web2\/src\/.*\.view\.tsx$/.test(filename) &&
  !/\/packages\/web2\/bin\//.test(filename);

const violatesRuntimeBoundary = (filename, text) =>
  shouldRunRuntimeBoundary(filename) &&
  runtimeBoundaryPatterns.some((pattern) => pattern.test(text));

const violatesRuntimeTestSupportBoundary = (filename, text) =>
  productionRuntimePattern.test(filename) &&
  !pathAllowedByPolicy(filename, runtimeTestSupportRatchet) &&
  testSupportImportPattern.test(text);

const violatesSeedBoundary = (filename, text) =>
  productionSeedBoundaryPattern.test(filename) && seedImportPattern.test(text);

export const importRuntimeBoundaries = createRule({
  description: "Keep platform imports and runtime literals behind named boundaries.",
  messages: {
    invariant:
      "Keep platform imports, runtime config, route literals, media providers, test helpers, and seed fixtures behind boundary modules.",
  },
  create(context) {
    return {
      Program(node) {
        const filename = normalizedFilename(context);
        const text = sourceText(context);
        if (
          violatesRuntimeBoundary(filename, text) ||
          violatesRuntimeTestSupportBoundary(filename, text) ||
          violatesSeedBoundary(filename, text)
        ) {
          report(context, node, "invariant");
        }
      },
    };
  },
});
