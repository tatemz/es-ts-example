import { isStaticCall } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { createRule, report } from "../shared/rule.mjs";
import { pathAllowedByPolicy, relativeFilename } from "../shared/policy-paths.mjs";

export const effectBoundariesRuleName = "effect-boundaries";

const asyncAwaitMessage =
  "Use Effect.gen with yield* instead of async/await; wrap foreign promises with Effect.promise/Effect.tryPromise at an allowlisted boundary.";

const effectRunnerBoundary = {
  paths: [
    "packages/test-support/src/TestEffect.ts",
    "packages/test-support/src/run-effect-main.ts",
    "packages/web/bin/main.ts",
    "packages/web/bin/uxAudit.ts",
    "packages/web/test/visual/support/playwright-effect.ts",
    "packages/web/test/visual/support/start-visual-server.ts",
    "packages/web2/bin/main.ts",
  ],
};

// ponytail: throwaway web2 draft store keeps mutable module state; ceiling = process memory, upgrade = Effect Ref/service.
const mutableModuleStateBoundary = {
  paths: ["packages/web2/src/create/draftStore.ts"],
};

const asyncBoundary = {
  paths: effectRunnerBoundary.paths,
  patterns: [/^scripts\/[^/]+\.ts$/, /^packages\/web\/test\/visual\//],
};

const shouldRun = (filename) => {
  const relative = relativeFilename(filename);
  return (
    /\.(?:ts|tsx)$/.test(relative) &&
    !/\.d\.ts$/.test(relative) &&
    !/\/public\/client\.js$/.test(relative) &&
    relative !== "test/unit/oxlint-rules.test.mjs"
  );
};

const runPromiseAllowed = (filename) => pathAllowedByPolicy(filename, effectRunnerBoundary);
const asyncAwaitAllowed = (filename) => pathAllowedByPolicy(filename, asyncBoundary);

const isPromiseConstructor = (node) =>
  node.callee?.type === "Identifier" && node.callee.name === "Promise";

const isCucumberImport = (node) =>
  node.source?.type === "Literal" && node.source.value === "@cucumber/cucumber";

const hasAsyncModifier = (node) => node.async === true;

export const effectBoundaries = createRule({
  description: "Keep Effect execution boundaries explicit.",
  messages: {
    asyncAwait: asyncAwaitMessage,
    cucumber: "Use effect-bdd instead of the Cucumber runner/global step API.",
    letDeclaration: "Use const and Effect state instead of let.",
    promiseConstructor:
      "Use Effect.callback, Effect.promise, or Effect.tryPromise instead of new Promise.",
    runPromise: "Effect.runPromise is only allowed in explicit runner/main boundary modules.",
    tryStatement:
      "Use Effect.try/tryPromise at boundaries and Effect catch/tap/ensuring/acquireRelease inside Effect code.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!shouldRun(filename)) {
      return {};
    }

    return {
      ArrowFunctionExpression(node) {
        if (hasAsyncModifier(node) && !asyncAwaitAllowed(filename)) {
          report(context, node, "asyncAwait");
        }
      },
      AwaitExpression(node) {
        if (!asyncAwaitAllowed(filename)) {
          report(context, node, "asyncAwait");
        }
      },
      ForOfStatement(node) {
        if (node.await === true && !asyncAwaitAllowed(filename)) {
          report(context, node, "asyncAwait");
        }
      },
      FunctionDeclaration(node) {
        if (hasAsyncModifier(node) && !asyncAwaitAllowed(filename)) {
          report(context, node, "asyncAwait");
        }
      },
      FunctionExpression(node) {
        if (hasAsyncModifier(node) && !asyncAwaitAllowed(filename)) {
          report(context, node, "asyncAwait");
        }
      },
      ImportDeclaration(node) {
        if (isCucumberImport(node)) {
          report(context, node, "cucumber");
        }
      },
      NewExpression(node) {
        if (isPromiseConstructor(node)) {
          report(context, node, "promiseConstructor");
        }
      },
      TryStatement(node) {
        report(context, node, "tryStatement");
      },
      VariableDeclaration(node) {
        if (node.kind === "let" && !pathAllowedByPolicy(filename, mutableModuleStateBoundary)) {
          report(context, node, "letDeclaration");
        }
      },
      CallExpression(node) {
        if (isStaticCall(node, "Effect", "runPromise") && !runPromiseAllowed(filename)) {
          report(context, node, "runPromise");
        }
      },
    };
  },
});
