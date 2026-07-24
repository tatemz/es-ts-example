import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import { isModelFilename, modelOwnershipFromFilename } from "../shared/mvc-ownership.mjs";

const exportedSchemaNamesFromDeclaration = (declaration) => {
  if (declaration.type !== "VariableDeclaration") {
    return [];
  }

  return Fn.pipe(
    declaration.declarations,
    Arr.flatMap((variable) => {
      const init = variable.init;
      return variable.id.type === "Identifier" && isOwnedSchemaConstructor(init)
        ? [{ name: variable.id.name, node: variable.id, init }]
        : [];
    }),
  );
};

const isOwnedSchemaConstructor = (init) =>
  init?.type === "CallExpression" &&
  init.callee.type === "MemberExpression" &&
  init.callee.object.type === "Identifier" &&
  init.callee.object.name === "Schema" &&
  init.callee.property.type === "Identifier" &&
  Fn.pipe(["TaggedStruct", "TaggedUnion", "Union"], Arr.contains(init.callee.property.name));

const exportedSchemaNames = (program) =>
  Fn.pipe(
    program.body,
    Arr.flatMap((statement) =>
      statement.type === "ExportNamedDeclaration" && statement.declaration !== null
        ? exportedSchemaNamesFromDeclaration(statement.declaration)
        : [],
    ),
  );

const typeofModelTypeName = (node) => {
  if (
    node.type !== "TSTypeQuery" ||
    node.exprName.type !== "TSQualifiedName" ||
    node.exprName.left.type !== "Identifier" ||
    node.exprName.right.name !== "Type"
  ) {
    return Option.none();
  }

  return Option.some(node.exprName.left.name);
};

const exportedModelTypes = (program) =>
  Fn.pipe(
    program.body,
    Arr.flatMap((statement) => {
      if (
        statement.type !== "ExportNamedDeclaration" ||
        statement.declaration?.type !== "TSTypeAliasDeclaration"
      ) {
        return [];
      }

      const declaration = statement.declaration;
      return Fn.pipe(
        typeofModelTypeName(declaration.typeAnnotation),
        Option.map((schemaName) => [
          { name: declaration.id.name, schemaName, node: declaration.id },
        ]),
        Option.getOrElse(() => []),
      );
    }),
  );

const exportedFactoryNames = (program) =>
  Fn.pipe(
    program.body,
    Arr.flatMap((statement) => {
      if (statement.type !== "ExportNamedDeclaration" || statement.declaration === null) {
        return [];
      }

      const declaration = statement.declaration;
      if (declaration.type === "FunctionDeclaration" && declaration.id !== null) {
        return [declaration.id.name];
      }

      if (declaration.type !== "VariableDeclaration") {
        return [];
      }

      return Fn.pipe(
        declaration.declarations,
        Arr.flatMap((variable) =>
          variable.id.type === "Identifier" && /^make[A-Z].*Model$/.test(variable.id.name)
            ? [variable.id.name]
            : [],
        ),
      );
    }),
  );

export const modelRole = {
  matches: isModelFilename,
  messages: {
    modelFactoryInModel:
      "Model factories live in `../factories/<layer>/<stem>.factory.ts`, not model definition files.",
    modelMissingModel: "Model files must export their owned schema `{{modelName}}`.",
    modelMissingType: "Model files must export `type {{modelName}} = typeof {{modelName}}.Type`.",
    modelMultipleModels:
      "Model files must export only `{{modelName}}`; keep additional render schemas private or move them to another model file.",
  },
  check(context, node, filename) {
    const ownership = modelOwnershipFromFilename(filename);
    const models = exportedSchemaNames(node);
    const types = exportedModelTypes(node);
    const factories = exportedFactoryNames(node);
    const hasOwnedModel = Fn.pipe(
      models,
      Arr.some((model) => model.name === ownership.modelName),
    );
    const hasOwnedType = Fn.pipe(
      types,
      Arr.some(
        (modelType) =>
          modelType.name === ownership.modelName && modelType.schemaName === ownership.modelName,
      ),
    );

    if (!hasOwnedModel) {
      context.report({
        node,
        messageId: "modelMissingModel",
        data: { modelName: ownership.modelName },
      });
    }

    if (!hasOwnedType) {
      context.report({
        node,
        messageId: "modelMissingType",
        data: { modelName: ownership.modelName },
      });
    }

    Fn.pipe(
      factories,
      Arr.map((factory) =>
        context.report({
          node,
          messageId: "modelFactoryInModel",
          data: { factoryName: factory },
        }),
      ),
    );

    Fn.pipe(
      models,
      Arr.filter((model) => model.name !== ownership.modelName),
      Arr.map((model) =>
        context.report({
          node: model.node,
          messageId: "modelMultipleModels",
          data: { modelName: ownership.modelName, extraModelName: model.name },
        }),
      ),
    );
  },
};
