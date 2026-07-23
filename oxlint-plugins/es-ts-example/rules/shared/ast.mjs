export const identifierName = (node) =>
  node?.type === "Identifier"
    ? node.name
    : node?.type === "PrivateIdentifier"
      ? node.name
      : undefined;

export const staticMemberName = (node) =>
  node?.type === "MemberExpression" && node.computed === false
    ? identifierName(node.property)
    : undefined;

export const isLengthMember = (node) =>
  node?.type === "MemberExpression" &&
  node.computed === false &&
  node.property.type === "Identifier" &&
  node.property.name === "length";

export const staticMemberRootName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }

  return node?.type === "MemberExpression" && node.computed === false
    ? staticMemberRootName(node.object)
    : undefined;
};

export const isStaticCall = (node, rootName, memberName) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.computed === false &&
  staticMemberRootName(node.callee.object) === rootName &&
  staticMemberName(node.callee) === memberName;

export const hasObjectProperties = (node, propertyNames) => {
  if (node?.type !== "ObjectExpression") {
    return false;
  }

  const names = new Set(
    node.properties.flatMap((property) => {
      if (property.type !== "Property") {
        return [];
      }

      const key = property.key;
      if (key.type === "Identifier") {
        return [key.name];
      }

      return key.type === "Literal" && typeof key.value === "string" ? [key.value] : [];
    }),
  );

  return propertyNames.every((name) => names.has(name));
};

export const isFunctionLike = (node) =>
  node?.type === "FunctionExpression" ||
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionDeclaration";

const present = (nodes) => nodes.filter((node) => node !== null && node !== undefined);

const expressionChildren = (node) => {
  switch (node.type) {
    case "ArrayExpression":
      return present(node.elements);
    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
    case "FunctionExpression":
      return [node.body];
    case "AssignmentExpression":
    case "AssignmentPattern":
    case "BinaryExpression":
    case "LogicalExpression":
      return [node.left, node.right];
    case "AwaitExpression":
    case "ChainExpression":
    case "ExpressionStatement":
    case "ReturnStatement":
    case "SpreadElement":
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
    case "UnaryExpression":
    case "UpdateExpression":
      return present([node.argument ?? node.expression]);
    case "BlockStatement":
      return node.body;
    case "CallExpression":
    case "NewExpression":
      return [node.callee, ...node.arguments];
    case "ConditionalExpression":
      return [node.test, node.consequent, node.alternate];
    case "IfStatement":
      return present([node.test, node.consequent, node.alternate]);
    case "MemberExpression":
      return node.computed ? [node.object, node.property] : [node.object];
    case "ObjectExpression":
      return node.properties;
    case "Property":
      return node.computed ? [node.key, node.value] : [node.value];
    case "SequenceExpression":
      return node.expressions;
    case "TaggedTemplateExpression":
      return [node.tag, node.quasi];
    case "TemplateLiteral":
      return node.expressions;
    case "VariableDeclaration":
      return node.declarations;
    case "VariableDeclarator":
      return present([node.init]);
    default:
      return [];
  }
};

export const walkExpression = (node, visit, seen = new WeakSet()) => {
  if (node === null || typeof node !== "object") {
    return;
  }

  if (seen.has(node)) {
    return;
  }
  seen.add(node);

  if (isFunctionLike(node) || node.type === "ClassBody") {
    return;
  }

  visit(node);

  for (const child of expressionChildren(node)) {
    walkExpression(child, visit, seen);
  }
};

export const walkTopLevelExpression = (statement, visit) => {
  if (statement.type === "VariableDeclaration") {
    for (const declaration of statement.declarations) {
      walkExpression(declaration.init, visit);
    }
    return;
  }

  if (statement.type === "ExpressionStatement") {
    walkExpression(statement.expression, visit);
    return;
  }

  if (
    (statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration") &&
    statement.declaration !== null &&
    statement.declaration !== undefined
  ) {
    walkTopLevelExpression(statement.declaration, visit);
  }
};

export const walkAst = (node, visit, seen = new WeakSet()) => {
  if (node === null || typeof node !== "object") {
    return;
  }

  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  visit(node);

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "parent" ||
      key === "range" ||
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key === "comments"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child?.type !== undefined) {
          walkAst(child, visit, seen);
        }
      }
      continue;
    }

    if (value?.type !== undefined) {
      walkAst(value, visit, seen);
    }
  }
};
