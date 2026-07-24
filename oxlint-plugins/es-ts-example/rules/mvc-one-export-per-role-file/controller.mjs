import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { getBasename } from "../shared/filename.mjs";

export const isControllerFilename = (filename) => /\.controller\.ts$/.test(getBasename(filename));

const exportedBindings = (statement) => {
  if (statement.type === "ExportDefaultDeclaration" || statement.type === "ExportAllDeclaration") {
    return [{ kind: "invalid", node: statement }];
  }

  if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") {
    return [];
  }

  if (statement.declaration === null) {
    return Fn.pipe(
      statement.specifiers,
      Arr.filter((specifier) => specifier.exportKind !== "type"),
      Arr.map((specifier) => ({ kind: "invalid", node: specifier })),
    );
  }

  const declaration = statement.declaration;
  if (
    declaration.type === "TSTypeAliasDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
  ) {
    return [];
  }

  if (declaration.type === "FunctionDeclaration") {
    return declaration.id === null
      ? [{ kind: "invalid", node: declaration }]
      : [{ kind: "function", name: declaration.id.name, node: declaration.id }];
  }

  if (declaration.type !== "VariableDeclaration") {
    return [{ kind: "invalid", node: declaration }];
  }

  return Fn.pipe(
    declaration.declarations,
    Arr.map((variable) => {
      const isFunction =
        variable.init?.type === "ArrowFunctionExpression" ||
        variable.init?.type === "FunctionExpression";
      return variable.id.type === "Identifier" && isFunction
        ? { kind: "function", name: variable.id.name, node: variable.id }
        : { kind: "invalid", node: variable.id };
    }),
  );
};

export const controllerRole = {
  matches: isControllerFilename,
  messages: {
    controllerInvalidExport:
      "Controller files may export only their single `*Controller` function; move shared runtime code to a support module.",
    controllerOneController:
      "Controller files must export exactly one `*Controller` function. Found {{count}}.",
  },
  check(context, node) {
    const bindings = Fn.pipe(node.body, Arr.flatMap(exportedBindings));
    const isController = (binding) =>
      binding.kind === "function" && binding.name !== undefined && /Controller$/.test(binding.name);
    const controllers = Fn.pipe(bindings, Arr.filter(isController));

    if (controllers.length !== 1) {
      context.report({
        node,
        messageId: "controllerOneController",
        data: { count: `${controllers.length}` },
      });
    }

    Fn.pipe(
      bindings,
      Arr.filter((binding) => !isController(binding)),
      Arr.map((binding) =>
        context.report({
          node: binding.node,
          messageId: "controllerInvalidExport",
        }),
      ),
    );
  },
};
