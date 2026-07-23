import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";

export const mvcControllerNoModelFactoriesRuleName = "mvc-controller-no-model-factories";

const isControllerFilename = (filename) => /\.controller\.ts$/.test(getBasename(filename));

const directTypeName = (annotation) =>
  annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier"
    ? annotation.typeName.name
    : undefined;

const returnsModel = (functionNode, variable) => {
  const functionReturn = directTypeName(functionNode?.returnType?.typeAnnotation);
  if (functionReturn !== undefined) {
    return /Model$/.test(functionReturn);
  }

  if (
    variable?.id.type !== "Identifier" ||
    variable.id.typeAnnotation === undefined ||
    variable.id.typeAnnotation === null
  ) {
    return false;
  }

  const annotation = variable.id.typeAnnotation.typeAnnotation;
  return (
    annotation.type === "TSFunctionType" &&
    /Model$/.test(directTypeName(annotation.returnType) ?? "")
  );
};

const namedModelFactory = (name, functionNode, variable) =>
  (/Model$/.test(name) && !/^(?:has|is)/.test(name)) || returnsModel(functionNode, variable);

const modelConstructorCall = (node) => {
  if (node.callee.type !== "MemberExpression") {
    return false;
  }

  const member = node.callee;
  const objectIsModel = member.object.type === "Identifier" && /Model$/.test(member.object.name);
  const propertyIsMake =
    (!member.computed &&
      member.property.type === "Identifier" &&
      member.property.name === "make") ||
    (member.computed && member.property.type === "Literal" && member.property.value === "make");
  return objectIsModel && propertyIsMake;
};

export const mvcControllerNoModelFactories = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent web controllers from defining render-model factories while allowing calls to factory modules.",
    },
    messages: {
      modelConstructor:
        "Controllers must not construct render models directly. Call the model's factory module.",
      modelFactory:
        "Controllers must not define model factory functions. Move this function into the model's factory file.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (
      !isRealFilename(filename) ||
      !isWebSourcePath(filename) ||
      !isControllerFilename(filename)
    ) {
      return {};
    }

    return {
      CallExpression(node) {
        if (modelConstructorCall(node)) {
          context.report({ node, messageId: "modelConstructor" });
        }
      },
      FunctionDeclaration(node) {
        if (node.id !== null && namedModelFactory(node.id.name, node, undefined)) {
          context.report({ node: node.id, messageId: "modelFactory" });
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== "Identifier" ||
          (node.init?.type !== "ArrowFunctionExpression" &&
            node.init?.type !== "FunctionExpression")
        ) {
          return;
        }

        if (namedModelFactory(node.id.name, node.init, node)) {
          context.report({ node: node.id, messageId: "modelFactory" });
        }
      },
    };
  },
};
