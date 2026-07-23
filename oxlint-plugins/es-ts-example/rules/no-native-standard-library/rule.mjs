import { isStaticCall, staticMemberName } from "../shared/ast.mjs";
import { normalizedFilename } from "../shared/context.mjs";
import { packageProductionPath } from "../shared/paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const noNativeStandardLibraryRuleName = "no-native-standard-library";

const replacementByNativeMember = new Map([
  ["Array.from", "Arr.fromIterable"],
  ["Array.isArray", "Arr.isArray"],
  ["Array.of", "Arr.of"],
  ["Array.prototype.at", "Arr.get"],
  ["Array.prototype.concat", "Arr.appendAll / Arr.prependAll"],
  ["Array.prototype.copyWithin", "Arr.copy"],
  ["Array.prototype.entries", "Arr.zipWith"],
  ["Array.prototype.every", "Arr.every"],
  ["Array.prototype.filter", "Arr.filter"],
  ["Array.prototype.find", "Arr.findFirst"],
  ["Array.prototype.findIndex", "Arr.findFirstIndex"],
  ["Array.prototype.findLast", "Arr.findLast"],
  ["Array.prototype.findLastIndex", "Arr.findLastIndex"],
  ["Array.prototype.flat", "Arr.flatten"],
  ["Array.prototype.flatMap", "Arr.flatMap"],
  ["Array.prototype.forEach", "Arr.forEach"],
  ["Array.prototype.includes", "Arr.contains"],
  ["Array.prototype.indexOf", "Arr.findFirstIndex"],
  ["Array.prototype.join", "Arr.join"],
  ["Array.prototype.keys", "Arr.map"],
  ["Array.prototype.lastIndexOf", "Arr.findLastIndex"],
  ["Array.prototype.map", "Arr.map"],
  ["Array.prototype.pop", "Arr.unappend"],
  ["Array.prototype.push", "Arr.append / Arr.appendAll"],
  ["Array.prototype.reduce", "Arr.reduce"],
  ["Array.prototype.reduceRight", "Arr.reduceRight"],
  ["Array.prototype.reverse", "Arr.reverse"],
  ["Array.prototype.shift", "Arr.unprepend"],
  ["Array.prototype.slice", "Arr.take / Arr.drop / Arr.splitAt"],
  ["Array.prototype.some", "Arr.some"],
  ["Array.prototype.sort", "Arr.sort"],
  ["Array.prototype.splice", "Arr.insertAt / Arr.remove / Arr.replace"],
  ["Array.prototype.toReversed", "Arr.reverse"],
  ["Array.prototype.toSorted", "Arr.sort"],
  ["Array.prototype.toSpliced", "Arr.insertAt / Arr.remove / Arr.replace"],
  ["Array.prototype.unshift", "Arr.prepend / Arr.prependAll"],
  ["Array.prototype.values", "Arr.map"],
  ["BigInt", "BigInt.fromString / BigInt.fromNumber"],
  ["Boolean", "Boolean.match / Boolean.isBoolean"],
  ["Date.now", "DateTime.now / DateTime.nowUnsafe"],
  ["Date.prototype.getTime", "DateTime.toEpochMillis"],
  ["Date.prototype.toISOString", "DateTime.formatIso"],
  ["Math.max", "Number.max / BigInt.max"],
  ["Math.min", "Number.min / BigInt.min"],
  ["Math.round", "Number.round"],
  ["Number", "Number.parse"],
  ["Number.isFinite", "Number.isNumber"],
  ["Number.isInteger", "Number.isNumber"],
  ["Number.isNaN", "Number.isNumber"],
  ["Number.parseFloat", "Number.parse"],
  ["Number.parseInt", "Number.parse"],
  ["Object.assign", "Struct.assign"],
  ["Object.entries", "Rec.toEntries"],
  ["Object.fromEntries", "Rec.fromEntries"],
  ["Object.hasOwn", "Rec.has"],
  ["Object.keys", "Rec.keys / Struct.keys"],
  ["Object.values", "Rec.values"],
  ["RegExp.escape", "RegExp.escape"],
  ["String", "Str.String / Str.isString"],
  ["String.prototype.at", "Str.at"],
  ["String.prototype.charAt", "Str.charAt"],
  ["String.prototype.charCodeAt", "Str.charCodeAt"],
  ["String.prototype.codePointAt", "Str.codePointAt"],
  ["String.prototype.concat", "Str.concat"],
  ["String.prototype.endsWith", "Str.endsWith"],
  ["String.prototype.includes", "Str.includes"],
  ["String.prototype.indexOf", "Str.indexOf"],
  ["String.prototype.lastIndexOf", "Str.lastIndexOf"],
  ["String.prototype.localeCompare", "Str.localeCompare"],
  ["String.prototype.match", "Str.match"],
  ["String.prototype.matchAll", "Str.matchAll"],
  ["String.prototype.normalize", "Str.normalize"],
  ["String.prototype.padEnd", "Str.padEnd"],
  ["String.prototype.padStart", "Str.padStart"],
  ["String.prototype.repeat", "Str.repeat"],
  ["String.prototype.replace", "Str.replace"],
  ["String.prototype.replaceAll", "Str.replaceAll"],
  ["String.prototype.search", "Str.search"],
  ["String.prototype.slice", "Str.slice / Str.takeLeft / Str.takeRight"],
  ["String.prototype.split", "Str.split"],
  ["String.prototype.startsWith", "Str.startsWith"],
  ["String.prototype.substring", "Str.substring"],
  ["String.prototype.toLocaleLowerCase", "Str.toLocaleLowerCase"],
  ["String.prototype.toLocaleUpperCase", "Str.toLocaleUpperCase"],
  ["String.prototype.toLowerCase", "Str.toLowerCase"],
  ["String.prototype.toUpperCase", "Str.toUpperCase"],
  ["String.prototype.trim", "Str.trim"],
  ["String.prototype.trimEnd", "Str.trimEnd"],
  ["String.prototype.trimStart", "Str.trimStart"],
]);

const staticNativeCalls = new Map(
  [...replacementByNativeMember].flatMap(([nativeMember, replacement]) => {
    const parts = nativeMember.split(".");
    return parts.length === 2 ? [[nativeMember, replacement]] : [];
  }),
);

const prototypeMethodReplacements = new Map(
  [...replacementByNativeMember].flatMap(([nativeMember, replacement]) => {
    const match = /^(Array|Date|String)\.prototype\.(.+)$/.exec(nativeMember);
    return match === null ? [] : [[match[2], replacement]];
  }),
);

const effectNamespaceNames = new Set([
  "Arr",
  "Array",
  "BigInt",
  "Boolean",
  "Cache",
  "Context",
  "DateTime",
  "Effect",
  "Fn",
  "Iterable",
  "Layer",
  "Match",
  "Number",
  "Option",
  "Rec",
  "Record",
  "RegExp",
  "Result",
  "Schema",
  "Str",
  "String",
  "Stream",
  "Struct",
]);

const unwrapChain = (node) => (node?.type === "ChainExpression" ? node.expression : node);

const effectNamespaceCall = (callee) =>
  callee.object?.type === "Identifier" && effectNamespaceNames.has(callee.object.name);

const isArrayBufferCopy = (callee, methodName) =>
  methodName === "slice" &&
  callee.object?.type === "MemberExpression" &&
  staticMemberName(callee.object) === "buffer";

const replacementForStaticCall = (node) => {
  if (node.callee?.type !== "MemberExpression" || node.callee.computed === true) {
    return undefined;
  }

  if (
    isStaticCall(node, "Object", "assign") &&
    node.arguments[0]?.type === "Identifier" &&
    node.arguments[0].name.endsWith("Tag")
  ) {
    return undefined;
  }

  const objectName =
    node.callee.object?.type === "Identifier" ? node.callee.object.name : undefined;
  const memberName = staticMemberName(node.callee);
  return objectName === undefined || memberName === undefined
    ? undefined
    : staticNativeCalls.get(`${objectName}.${memberName}`);
};

const replacementForPrototypeCall = (callee) => {
  if (
    callee?.type !== "MemberExpression" ||
    callee.computed === true ||
    effectNamespaceCall(callee)
  ) {
    return undefined;
  }

  const methodName = staticMemberName(callee);
  return methodName === undefined || isArrayBufferCopy(callee, methodName)
    ? undefined
    : prototypeMethodReplacements.get(methodName);
};

export const noNativeStandardLibrary = createRule({
  description: "Prefer Effect standard library helpers over native JavaScript library calls.",
  messages: {
    native:
      "Use Effect standard library helpers instead of native JavaScript library calls in package production code.",
    jsonRoundtrip:
      "Use explicit object construction or Schema-backed JSON boundaries instead of JSON.parse(JSON.stringify(...)).",
  },
  create(context) {
    if (!packageProductionPath(normalizedFilename(context))) {
      return {};
    }

    return {
      CallExpression(node) {
        if (
          isStaticCall(node, "JSON", "parse") &&
          node.arguments[0] !== undefined &&
          isStaticCall(node.arguments[0], "JSON", "stringify")
        ) {
          report(context, node, "jsonRoundtrip");
          return;
        }

        if (replacementForStaticCall(node) !== undefined) {
          report(context, node, "native");
          return;
        }

        const callee = unwrapChain(node.callee);
        if (replacementForPrototypeCall(callee) !== undefined) {
          report(context, node, "native");
        }
      },
    };
  },
});
