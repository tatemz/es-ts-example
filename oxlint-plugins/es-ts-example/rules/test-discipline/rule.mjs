import { testPath } from "../shared/paths.mjs";
import { sourceRule } from "../shared/source-rule.mjs";

export const testDisciplineRuleName = "test-discipline";

export const testDiscipline = sourceRule({
  description: "Keep tests on public Effect and assertion boundaries.",
  message:
    "Use TestEffect, public RPC contracts, named assertions, and deterministic property bounds.",
  patterns: [/\btestEffect\s*\([\s\S]*Effect\.run(?:Sync|SyncExit|Promise|PromiseExit|Fork)\b/],
  shouldRun: (filename) =>
    testPath(filename) &&
    !/\/packages\/(?:event-sourcing|test-support)\/test\//.test(filename) &&
    !/\/test\/unit\/oxlint-rules\.test\.mjs$/.test(filename),
});
