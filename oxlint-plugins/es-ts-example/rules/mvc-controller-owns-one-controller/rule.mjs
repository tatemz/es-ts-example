import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { getBasename, isRealFilename, isWebSourcePath } from "../shared/filename.mjs";

export const mvcControllerOwnsOneControllerRuleName = "mvc-controller-owns-one-controller";

const isControllerFilename = (filename) => /\.controller\.ts$/.test(getBasename(filename));

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

export const mvcControllerOwnsOneController = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require each web controller file to export exactly one controller and no other runtime bindings.",
    },
    messages: {
      invalidExport:
        "Controller files may export only their single `*Controller` function; move shared runtime code to a support module.",
      oneController:
        "Controller files must export exactly one `*Controller` function. Found {{count}}.",
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
      Program(node) {
        const bindings = Fn.pipe(node.body, Arr.flatMap(exportedBindings));
        const controllers = Fn.pipe(
          bindings,
          Arr.filter(
            (binding) =>
              binding.kind === "function" &&
              binding.name !== undefined &&
              /Controller$/.test(binding.name),
          ),
        );

        if (controllers.length !== 1) {
          context.report({
            node,
            messageId: "oneController",
            data: { count: `${controllers.length}` },
          });
        }

        Fn.pipe(
          bindings,
          Arr.filter(
            (binding) =>
              binding.kind !== "function" ||
              binding.name === undefined ||
              !/Controller$/.test(binding.name),
          ),
          Arr.map((binding) =>
            context.report({
              node: binding.node,
              messageId: "invalidExport",
            }),
          ),
        );
      },
    };
  },
};
