import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { factoryOwnershipFromFilename, isFactoryFilename } from "../shared/mvc-ownership.mjs";
import { modelImportSourceForStem, webMvcLayer } from "../shared/paths.mjs";

const typeReferenceName = (annotation) =>
  annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier"
    ? annotation.typeName.name
    : undefined;

const functionNodeFromDeclaration = (declaration, init) => {
  if (declaration?.type === "FunctionDeclaration") {
    return declaration;
  }

  if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
    return init;
  }

  return undefined;
};

const explicitReturnTypeName = (declaration, variable) => {
  const functionNode = functionNodeFromDeclaration(declaration, variable?.init);
  if (functionNode !== undefined) {
    return typeReferenceName(functionNode.returnType?.typeAnnotation);
  }

  if (variable?.id.type === "Identifier" && variable.id.typeAnnotation !== undefined) {
    const annotation = variable.id.typeAnnotation.typeAnnotation;
    if (annotation.type === "TSFunctionType") {
      return typeReferenceName(annotation.returnType);
    }

    return typeReferenceName(annotation);
  }

  return undefined;
};

const exportedFactoryBindingsFromStatement = (statement) => {
  if (statement.type === "ExportDefaultDeclaration") {
    return [{ kind: "default", node: statement, declaration: statement.declaration }];
  }

  if (statement.type === "ExportAllDeclaration") {
    return [{ kind: "re-export-all", node: statement }];
  }

  if (statement.type !== "ExportNamedDeclaration") {
    return [];
  }

  if (statement.exportKind === "type") {
    return [{ kind: "type-export", node: statement }];
  }

  if (statement.declaration === null) {
    return Fn.pipe(
      statement.specifiers,
      Arr.map((specifier) => ({
        kind: specifier.exportKind === "type" ? "type-export" : "re-export",
        node: specifier,
        declaration: null,
      })),
    );
  }

  const declaration = statement.declaration;
  if (
    declaration.type === "TSTypeAliasDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
  ) {
    return [{ kind: "type-export", node: declaration, declaration }];
  }

  if (declaration.type === "FunctionDeclaration") {
    return declaration.id === null
      ? []
      : [{ kind: "function", node: declaration.id, declaration, variable: undefined }];
  }

  if (declaration.type !== "VariableDeclaration") {
    return [{ kind: "non-function", node: declaration, declaration, variable: undefined }];
  }

  return Fn.pipe(
    declaration.declarations,
    Arr.map((variable) => ({
      kind: "variable",
      node: variable.id,
      declaration,
      variable,
    })),
  );
};

const exportedFactoryBindings = (program) =>
  Fn.pipe(program.body, Arr.flatMap(exportedFactoryBindingsFromStatement));

const isExportedFunction = (binding) => {
  if (binding.kind === "function") {
    return true;
  }

  if (binding.kind !== "variable" || binding.variable === undefined) {
    return false;
  }

  const init = binding.variable.init;
  return init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression";
};

const importsOwnedModel = (program, modelName, layer, stem) =>
  Fn.pipe(
    program.body,
    Arr.some((statement) => {
      if (
        statement.type !== "ImportDeclaration" ||
        statement.source.value !== modelImportSourceForStem(layer, stem)
      ) {
        return false;
      }

      return Fn.pipe(
        statement.specifiers,
        Arr.some(
          (specifier) =>
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === modelName &&
            specifier.importKind !== "type",
        ),
      );
    }),
  );

const programCallsOwnedConstructor = (sourceCode, node, modelName) =>
  new RegExp(`\\b${modelName}\\.make\\s*\\(`).test(sourceCode.getText(node));

const ownedFactoryBindings = (bindings, factoryName) =>
  Fn.pipe(
    bindings,
    Arr.filter(
      (binding) => binding.node.type === "Identifier" && binding.node.name === factoryName,
    ),
  );

const reportBinding = (context, binding, ownership) => {
  if (
    binding.kind === "default" ||
    binding.kind === "re-export-all" ||
    binding.kind === "re-export"
  ) {
    context.report({
      node: binding.node,
      messageId: "factoryInvalidExport",
      data: { modelName: ownership.modelName },
    });
    return;
  }

  if (binding.kind === "type-export") {
    context.report({
      node: binding.node,
      messageId: "factoryTypeExport",
      data: { modelName: ownership.modelName },
    });
    return;
  }

  if (!isExportedFunction(binding)) {
    context.report({
      node: binding.node,
      messageId: "factoryInvalidExport",
      data: { modelName: ownership.modelName },
    });
    return;
  }

  if (explicitReturnTypeName(binding.declaration, binding.variable) !== ownership.modelName) {
    context.report({
      node: binding.node,
      messageId: "factoryInvalidReturnType",
      data: { modelName: ownership.modelName },
    });
  }
};

export const factoryRole = {
  matches: isFactoryFilename,
  messages: {
    factoryInvalidExport:
      "Factory files may export only functions with an explicit `{{modelName}}` return type.",
    factoryInvalidReturnType:
      "Exported factory functions must declare an explicit `{{modelName}}` return type.",
    factoryMissingFactory: "Factory files must export `{{factoryName}}`.",
    factoryMissingImport:
      "Factory files must import the owned model schema from `../../models/{{layer}}/{{stem}}.model.ts`.",
    factoryMissingConstructor:
      "Factory files must construct the owned model with `{{modelName}}.make(...)`.",
    factoryTypeExport:
      "Factory files must not export types; keep type definitions private or in models.",
  },
  check(context, node, filename) {
    const ownership = factoryOwnershipFromFilename(filename);
    const layer = webMvcLayer(filename);
    const bindings = exportedFactoryBindings(node);
    const ownedFactories = ownedFactoryBindings(bindings, ownership.factoryName);

    if (ownedFactories.length !== 1) {
      context.report({
        node,
        messageId: "factoryMissingFactory",
        data: { factoryName: ownership.factoryName },
      });
    }

    if (!importsOwnedModel(node, ownership.modelName, layer, ownership.stem)) {
      context.report({
        node,
        messageId: "factoryMissingImport",
        data: { layer, stem: ownership.stem },
      });
    }

    if (!programCallsOwnedConstructor(context.sourceCode, node, ownership.modelName)) {
      context.report({
        node,
        messageId: "factoryMissingConstructor",
        data: { modelName: ownership.modelName },
      });
    }

    Fn.pipe(
      bindings,
      Arr.map((binding) => reportBinding(context, binding, ownership)),
    );
  },
};
