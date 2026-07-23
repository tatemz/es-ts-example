import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";

export const mvcViewPrefersModelParameterRuleName = "mvc-view-prefers-model-parameter";

const viewSuffix = ".view.tsx";
const viewNamePattern = /View$/;

const isViewFile = (filename) => Fn.pipe(getBasename(filename), Str.endsWith(viewSuffix));

const exportedNamesFromStatement = (statement) => {
  if (statement.type !== "ExportNamedDeclaration" || statement.declaration === null) {
    return [];
  }

  const declaration = statement.declaration;
  if (declaration.type === "FunctionDeclaration" && declaration.id !== null) {
    return [declaration.id.name];
  }

  if (declaration.type === "VariableDeclaration") {
    return Fn.pipe(
      declaration.declarations,
      Arr.flatMap((variable) => (variable.id.type === "Identifier" ? [variable.id.name] : [])),
    );
  }

  return [];
};

const exportedNames = (program) => Fn.pipe(program.body, Arr.flatMap(exportedNamesFromStatement));

const hasExport = (exports, name) => Fn.pipe(exports, Arr.contains(name));

const firstParameter = (parameters) => Fn.pipe(parameters, Arr.get(0), Option.getOrUndefined);

const reportInvalidParameter = (context, parameter) => {
  if (parameter === undefined) {
    return;
  }

  if (parameter.type === "Identifier" && parameter.name === "model") {
    return;
  }

  context.report({
    node: parameter,
    messageId: parameter.type === "Identifier" ? "preferModelParameter" : "noDestructuredModel",
  });
};

export const mvcViewPrefersModelParameter = {
  meta: {
    type: "problem",
    docs: {
      description: "Require exported web MVC views to receive their model as a `model` parameter.",
    },
    messages: {
      noDestructuredModel: "Views should receive `model` and read fields as `model.field`.",
      preferModelParameter: "Views should name their model parameter `model`.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename) || !isViewFile(filename)) {
      return {};
    }

    const exports = () => exportedNames(context.sourceCode.ast);

    return {
      "VariableDeclarator[id.type='Identifier'][init.type='ArrowFunctionExpression']"(node) {
        if (hasExport(exports(), node.id.name) && viewNamePattern.test(node.id.name)) {
          reportInvalidParameter(context, firstParameter(node.init.params));
        }
      },
      FunctionDeclaration(node) {
        if (
          node.id !== null &&
          hasExport(exports(), node.id.name) &&
          viewNamePattern.test(node.id.name)
        ) {
          reportInvalidParameter(context, firstParameter(node.params));
        }
      },
    };
  },
};
