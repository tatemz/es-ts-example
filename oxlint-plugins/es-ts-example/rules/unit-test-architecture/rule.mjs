import { walkAst } from "../shared/ast.mjs";
import { normalizedFilename, sourceText } from "../shared/context.mjs";
import { pathAllowedByPolicy } from "../shared/policy-paths.mjs";
import { createRule } from "../shared/rule.mjs";

export const unitTestArchitectureRuleName = "unit-test-architecture";

const policies = [
  {
    directory: "/packages/application/",
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
  {
    directory: "/packages/domain/",
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
  {
    directory: "/packages/web/",
    indexMaxLines: 150,
    indexMaxTests: 5,
    indexMaxSourceImports: 1,
    fileMaxLines: 600,
  },
];

const indexRatchet = { paths: ["packages/application/test/unit/index.test.ts"] };
const sizeRatchet = {
  paths: [
    "packages/domain/test/unit/adventure.test.ts",
    "packages/domain/test/unit/experience.test.ts",
    "packages/domain/test/unit/payments.test.ts",
    "packages/application/test/unit/payments.test.ts",
    "packages/web/test/unit/adventure/adventure-4.test.ts",
    "packages/web/test/unit/creator/creator-2.test.ts",
  ],
};

const unitTestPattern = /\/packages\/[^/]+\/test\/unit\/.*\.test\.tsx?$/;
const supportPattern = /\/packages\/[^/]+\/test\/unit\/support\//;
const supportBarrelPattern = /\/packages\/[^/]+\/test\/unit\/support\/index\.tsx?$/;
const indexTestPattern = /\/packages\/[^/]+\/test\/unit\/index\.test\.tsx?$/;
const packageSourceImportPrefix = "../../src";
const forbiddenIndexSourcePattern =
  /^\.\.\/\.\.\/src\/(?!index\.ts$)|\.(?:model|factory|view|controller|service|repository)\.tsx?$/;

const policyFor = (filename) => policies.find((policy) => filename.includes(policy.directory));
const lineCount = (text) => text.split("\n").length;

const importSpecifiers = (program) =>
  program.body.flatMap((statement) =>
    statement.type === "ImportDeclaration" && typeof statement.source?.value === "string"
      ? [statement.source.value]
      : [],
  );

const countTestCalls = (program) => {
  let count = 0;
  walkAst(program, (node) => {
    if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      (node.callee.name === "test" || node.callee.name === "testEffect")
    ) {
      count += 1;
    }
  });
  return count;
};

export const unitTestArchitecture = createRule({
  description: "Keep unit tests sliced, local, and assertion-transparent.",
  messages: {
    fileTooLarge: "Unit test file has {{count}} lines; maximum is {{max}}.",
    indexImportCount: "index.test.ts has {{count}} package source imports; maximum is {{max}}.",
    indexTooLarge: "index.test.ts has {{count}} lines; maximum is {{max}}.",
    indexTooManyTests: "index.test.ts has {{count}} test calls; maximum is {{max}}.",
    invalidIndexImport: "index.test.ts must not import {{specifier}}; use a slice test.",
    supportAssertion: "Unit support files must not hide assertions.",
    supportBarrel: "Unit support barrels are banned; import concrete support files.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!unitTestPattern.test(filename) && !supportPattern.test(filename)) {
      return {};
    }

    return {
      Program(node) {
        const text = sourceText(context);
        const policy = policyFor(filename);

        if (supportBarrelPattern.test(filename)) {
          context.report({ node, messageId: "supportBarrel" });
        }
        if (supportPattern.test(filename) && /\b(?:expect|assert)\s*(?:\.|\()/.test(text)) {
          context.report({ node, messageId: "supportAssertion" });
        }

        if (policy === undefined || supportPattern.test(filename)) {
          return;
        }

        const lines = lineCount(text);
        if (indexTestPattern.test(filename)) {
          if (pathAllowedByPolicy(filename, indexRatchet)) {
            return;
          }

          const imports = importSpecifiers(node);
          const packageSourceImports = imports.filter((specifier) =>
            specifier.startsWith(packageSourceImportPrefix),
          );
          const testCalls = countTestCalls(node);

          if (lines > policy.indexMaxLines) {
            context.report({
              node,
              messageId: "indexTooLarge",
              data: { count: String(lines), max: String(policy.indexMaxLines) },
            });
          }
          if (testCalls > policy.indexMaxTests) {
            context.report({
              node,
              messageId: "indexTooManyTests",
              data: { count: String(testCalls), max: String(policy.indexMaxTests) },
            });
          }
          if (packageSourceImports.length > policy.indexMaxSourceImports) {
            context.report({
              node,
              messageId: "indexImportCount",
              data: {
                count: String(packageSourceImports.length),
                max: String(policy.indexMaxSourceImports),
              },
            });
          }
          for (const specifier of imports.filter((item) =>
            forbiddenIndexSourcePattern.test(item),
          )) {
            context.report({
              node,
              messageId: "invalidIndexImport",
              data: { specifier },
            });
          }
          return;
        }

        if (lines > policy.fileMaxLines && !pathAllowedByPolicy(filename, sizeRatchet)) {
          context.report({
            node,
            messageId: "fileTooLarge",
            data: { count: String(lines), max: String(policy.fileMaxLines) },
          });
        }
      },
    };
  },
});
