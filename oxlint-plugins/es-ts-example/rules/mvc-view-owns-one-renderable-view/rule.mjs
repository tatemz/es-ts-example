import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import { isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import {
  isViewFilename,
  modelStemFromImportSource,
  viewOwnershipFromFilename,
  viewOwnershipFromModelStem,
} from "../shared/mvc-ownership.mjs";

export const mvcViewOwnsOneRenderableViewRuleName = "mvc-view-owns-one-renderable-view";

const viewNamePattern = /View$/;

const exportedNamesFromStatement = (statement) => {
  if (statement.type !== "ExportNamedDeclaration") {
    return [];
  }

  if (statement.declaration === null) {
    return Fn.pipe(
      statement.specifiers,
      Arr.flatMap((specifier) =>
        specifier.type === "ExportSpecifier" && specifier.exported.type === "Identifier"
          ? [specifier.exported.name]
          : [],
      ),
    );
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
    Arr.flatMap((variable) => (variable.id.type === "Identifier" ? [variable.id.name] : [])),
  );
};

const exportedNames = (program) => Fn.pipe(program.body, Arr.flatMap(exportedNamesFromStatement));

const exportedTypeExportsFromStatement = (statement) => {
  if (statement.type === "ExportAllDeclaration" && statement.exportKind === "type") {
    return [{ node: statement }];
  }

  if (statement.type !== "ExportNamedDeclaration") {
    return [];
  }

  if (
    statement.exportKind === "type" ||
    statement.declaration?.type === "TSTypeAliasDeclaration" ||
    statement.declaration?.type === "TSInterfaceDeclaration" ||
    statement.declaration?.type === "TSEnumDeclaration"
  ) {
    return [{ node: statement.declaration ?? statement }];
  }

  if (statement.declaration === null) {
    return Fn.pipe(
      statement.specifiers,
      Arr.flatMap((specifier) =>
        specifier.exportKind === "type" || statement.exportKind === "type"
          ? [{ node: specifier }]
          : [],
      ),
    );
  }

  return [];
};

const exportedTypeExports = (program) =>
  Fn.pipe(program.body, Arr.flatMap(exportedTypeExportsFromStatement));

const viewDeclarationsFromStatement = (statement) => {
  if (statement.type === "FunctionDeclaration" && statement.id !== null) {
    return viewNamePattern.test(statement.id.name)
      ? [{ name: statement.id.name, node: statement, params: statement.params }]
      : [];
  }

  const declaration =
    statement.type === "ExportNamedDeclaration" && statement.declaration !== null
      ? statement.declaration
      : statement;

  if (declaration.type !== "VariableDeclaration") {
    return [];
  }

  return Fn.pipe(
    declaration.declarations,
    Arr.flatMap((variable) =>
      variable.id.type === "Identifier" &&
      viewNamePattern.test(variable.id.name) &&
      variable.init?.type === "ArrowFunctionExpression"
        ? [
            {
              name: variable.id.name,
              node: variable.id,
              params: variable.init.params,
              typeAnnotation: variable.id.typeAnnotation?.typeAnnotation,
            },
          ]
        : [],
    ),
  );
};

const viewDeclarations = (program) =>
  Fn.pipe(program.body, Arr.flatMap(viewDeclarationsFromStatement));

const modelImportsFromStatement = (statement) => {
  if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") {
    return [];
  }

  return Fn.pipe(
    modelStemFromImportSource(statement.source.value),
    Option.match({
      onNone: () => [],
      onSome: (modelStem) =>
        Fn.pipe(
          statement.specifiers,
          Arr.flatMap((specifier) =>
            specifier.type === "ImportSpecifier" && specifier.imported.type === "Identifier"
              ? [{ modelName: specifier.imported.name, modelStem, source: statement.source.value }]
              : [],
          ),
        ),
    }),
  );
};

const modelImports = (program) => Fn.pipe(program.body, Arr.flatMap(modelImportsFromStatement));

const firstParameter = (declaration) =>
  Fn.pipe(declaration.params, Arr.get(0), Option.getOrUndefined);

const parameterTypeName = (parameter) => {
  if (parameter?.type !== "Identifier" || parameter.typeAnnotation === undefined) {
    return Option.none();
  }

  const annotation = parameter.typeAnnotation.typeAnnotation;
  return annotation.type === "TSTypeReference" && annotation.typeName.type === "Identifier"
    ? Option.some(annotation.typeName.name)
    : Option.none();
};

const viewTypeArguments = (annotation) =>
  annotation.typeArguments?.params ?? annotation.typeParameters?.params ?? [];

const isViewTypeReference = (annotation) =>
  annotation?.type === "TSTypeReference" &&
  annotation.typeName.type === "Identifier" &&
  annotation.typeName.name === "View";

const typeReferenceIdentifierName = (node) =>
  node?.type === "TSTypeReference" && node.typeName.type === "Identifier"
    ? Option.some(node.typeName.name)
    : Option.none();

const viewTypeModelName = (annotation) => {
  if (!isViewTypeReference(annotation)) {
    return Option.none();
  }

  return Fn.pipe(
    viewTypeArguments(annotation),
    Arr.get(0),
    Option.flatMap(typeReferenceIdentifierName),
  );
};

const importForModelName = (imports, modelName) =>
  Fn.pipe(
    imports,
    Arr.findFirst((modelImport) => modelImport.modelName === modelName),
  );

const ownershipForView = (filename, modelImport) =>
  Fn.pipe(
    viewOwnershipFromModelStem(filename, modelImport.modelStem),
    Option.filter((ownership) => ownership.expectedModelName === modelImport.modelName),
  );

const singleDeclaration = (views) =>
  views.length === 1 ? Fn.pipe(views, Arr.get(0)) : Option.none();

const viewDetails = (program, filename, view) => {
  const first = firstParameter(view);
  const modelName = Fn.pipe(
    viewTypeModelName(view.typeAnnotation),
    Option.orElse(() => parameterTypeName(first)),
  );
  const importedModel = Fn.pipe(
    modelName,
    Option.flatMap((name) => importForModelName(modelImports(program), name)),
  );
  const ownership = Fn.pipe(
    importedModel,
    Option.flatMap((modelImport) => ownershipForView(filename, modelImport)),
  );

  return { first, importedModel, modelName, ownership };
};

const validModelParameter = (details) =>
  details.first?.type === "Identifier" && details.first.name === "model";

const validViewType = (view, details) =>
  Option.isSome(viewTypeModelName(view.typeAnnotation)) && Option.isSome(details.modelName);

const expectedViewName = (details) =>
  Fn.pipe(
    details.ownership,
    Option.map((ownership) => ownership.expectedViewName),
    Option.getOrUndefined,
  );

const modelNameText = (details) => Fn.pipe(details.modelName, Option.getOrUndefined);

const validModelImport = (details) =>
  Option.isSome(details.importedModel) && Option.isSome(details.ownership);

export const mvcViewOwnsOneRenderableView = {
  meta: {
    type: "problem",
    docs: {
      description: "Require each web MVC view file to own exactly one renderable view.",
    },
    messages: {
      invalidModel:
        "View files must accept their owned model type imported from `../../models/<stem>.model.ts`.",
      invalidName: "This view file must export `{{viewName}}` for `{{modelName}}`.",
      invalidParameter: "Views should receive `model: {{modelName}}`.",
      invalidViewType:
        "Views must be typed as `View<{{modelName}}>` or `View<{{modelName}}, HtmlSlotContent>`.",
      notExported: "View files must export their owned renderable view.",
      oneView:
        "View files must declare exactly one `{{ownedViewName}}` matching the file name; helper views keep other names.",
      typeExport:
        "View files must not export types; keep type definitions in the owned model file.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isViewFilename(filename)) {
      return {};
    }

    return {
      Program(node) {
        Fn.pipe(
          exportedTypeExports(node),
          Arr.map((typeExport) =>
            context.report({ node: typeExport.node, messageId: "typeExport" }),
          ),
        );

        const ownedViewName = viewOwnershipFromFilename(filename).expectedViewName;
        const ownedViews = Fn.pipe(
          viewDeclarations(node),
          Arr.filter((declaration) => declaration.name === ownedViewName),
        );
        const view = Fn.pipe(singleDeclaration(ownedViews), Option.getOrUndefined);

        if (view === undefined) {
          context.report({ node, messageId: "oneView", data: { ownedViewName } });
          return;
        }

        const details = viewDetails(node, filename, view);

        if (!validModelParameter(details)) {
          context.report({
            node: details.first ?? view.node,
            messageId: "invalidParameter",
            data: { modelName: "<OwnedModel>Model" },
          });
          return;
        }

        if (!validViewType(view, details)) {
          context.report({
            node: view.node,
            messageId: "invalidViewType",
            data: { modelName: "<OwnedModel>Model" },
          });
          return;
        }

        if (!validModelImport(details)) {
          context.report({ node: details.first, messageId: "invalidModel" });
          return;
        }

        if (expectedViewName(details) !== view.name) {
          context.report({
            node: view.node,
            messageId: "invalidName",
            data: { viewName: expectedViewName(details), modelName: modelNameText(details) },
          });
        }

        if (!Fn.pipe(exportedNames(node), Arr.contains(view.name))) {
          context.report({ node: view.node, messageId: "notExported" });
        }
      },
    };
  },
};
