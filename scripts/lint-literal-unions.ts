import ts from "typescript";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import { failPolicy } from "./policy-output.ts";

type LiteralSite = {
  readonly file: string;
  readonly line: number;
  readonly members: ReadonlyArray<string>;
};

type MemberUse = {
  readonly file: string;
  readonly line: number;
  readonly member: string;
};

const sourcePaths = Fn.pipe(
  [
    ...new Bun.Glob("packages/domain/src/**/*.ts").scanSync("."),
    ...new Bun.Glob("packages/application/src/**/*.ts").scanSync("."),
  ],
  Arr.dedupe,
);

const readText = async (path: string): Promise<string> => await Bun.file(path).text();

const isSchemaMemberAccess = (node: ts.Node, member: string): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "Schema" &&
  node.name.text === member;

const isSchemaMemberCall = (node: ts.Node, member: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && isSchemaMemberAccess(node.expression, member);

const isSchemaLiteralCall = (node: ts.Node): node is ts.CallExpression =>
  isSchemaMemberCall(node, "Literal");

const isSchemaUnionCall = (node: ts.Node): node is ts.CallExpression =>
  isSchemaMemberCall(node, "Union");

const literalMembers = (node: ts.Node): ReadonlyArray<string> => {
  const own = isSchemaLiteralCall(node)
    ? Fn.pipe(
        node.arguments,
        Arr.filter(ts.isStringLiteral),
        Arr.map((argument) => argument.text),
      )
    : [];
  return [...own, ...Fn.pipe(node.getChildren(), Arr.flatMap(literalMembers))];
};

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

/**
 * A union site is a `Schema.Union(...)` whose descendants define string
 * literals, or a standalone multi-member `Schema.Literal("a", "b")`.
 */
const unionSites = (sourceFile: ts.SourceFile, file: string): ReadonlyArray<LiteralSite> => {
  const siteForMembers = (
    node: ts.Node,
    members: ReadonlyArray<string>,
  ): ReadonlyArray<LiteralSite> =>
    members.length >= 2 ? [{ file, line: lineOf(sourceFile, node), members }] : [];

  const ownUnionSite = (node: ts.Node): ReadonlyArray<LiteralSite> =>
    siteForMembers(node, literalMembers(node));

  const ownLiteralSite = (node: ts.Node, insideUnion: boolean): ReadonlyArray<LiteralSite> => {
    if (insideUnion || !isSchemaLiteralCall(node)) {
      return [];
    }

    return siteForMembers(node, literalMembers(node));
  };

  const childSites = (node: ts.Node, insideUnion: boolean): ReadonlyArray<LiteralSite> =>
    Fn.pipe(
      node.getChildren(),
      Arr.flatMap((child) => sitesForNode(child, insideUnion)),
    );

  const sitesForNode = (node: ts.Node, insideUnion: boolean): ReadonlyArray<LiteralSite> => {
    if (isSchemaUnionCall(node)) {
      return [...ownUnionSite(node), ...childSites(node, true)];
    }

    return [...ownLiteralSite(node, insideUnion), ...childSites(node, insideUnion)];
  };
  return sitesForNode(sourceFile, false);
};

const isLiteralDefinitionPosition = (node: ts.Node): boolean =>
  node.parent !== undefined &&
  !ts.isSourceFile(node.parent) &&
  (isSchemaLiteralCall(node.parent) || isLiteralDefinitionPosition(node.parent));

const isValueLevelUse = (node: ts.StringLiteral): boolean =>
  !ts.isLiteralTypeNode(node.parent) &&
  !ts.isImportDeclaration(node.parent) &&
  !ts.isExportDeclaration(node.parent) &&
  !isLiteralDefinitionPosition(node);

const memberUses = (sourceFile: ts.SourceFile, file: string): ReadonlyArray<MemberUse> => {
  const usesForNode = (node: ts.Node): ReadonlyArray<MemberUse> => {
    const own =
      ts.isStringLiteral(node) && isValueLevelUse(node)
        ? [{ file, line: lineOf(sourceFile, node), member: node.text }]
        : [];
    return [...own, ...Fn.pipe(node.getChildren(), Arr.flatMap(usesForNode))];
  };
  return usesForNode(sourceFile);
};

const parsed = await Promise.all(
  Arr.map(sourcePaths, async (file) => {
    const sourceFile = ts.createSourceFile(
      file,
      await readText(file),
      ts.ScriptTarget.Latest,
      true,
    );
    return {
      sites: unionSites(sourceFile, file),
      uses: memberUses(sourceFile, file),
    };
  }),
);

const sites = Fn.pipe(
  parsed,
  Arr.flatMap((entry) => entry.sites),
);
const uses = Fn.pipe(
  parsed,
  Arr.flatMap((entry) => entry.uses),
);

const normalizedMembers = (site: LiteralSite): string =>
  Fn.pipe(site.members, Arr.dedupe, Arr.sort(Order.String), Arr.join("|"));

const duplicateUnionViolations = Fn.pipe(
  sites,
  Arr.groupBy(normalizedMembers),
  Rec.values,
  Arr.filter((group) => group.length >= 2),
  Arr.map(
    (group) =>
      `Duplicate literal union {${Fn.pipe(Arr.headNonEmpty(group).members, Arr.join(", "))}} defined at ${Fn.pipe(
        group,
        Arr.map((site) => `${site.file}:${site.line}`),
        Arr.join(" and "),
      )}; define it once and import the schema.`,
  ),
);

const definingFilesByMember = Fn.pipe(
  sites,
  Arr.flatMap((site) => Arr.map(site.members, (member) => ({ member, file: site.file }))),
  Arr.groupBy((definition) => definition.member),
);

const leakedUse = (use: MemberUse): boolean =>
  Fn.pipe(
    Rec.get(definingFilesByMember, use.member),
    Option.match({
      onNone: () => false,
      onSome: (definitions) =>
        Fn.pipe(
          definitions,
          Arr.every((definition) => definition.file !== use.file),
        ),
    }),
  );

const memberLeakViolations = Fn.pipe(
  uses,
  Arr.filter(leakedUse),
  Arr.map(
    (use) =>
      `${use.file}:${use.line}: raw literal "${use.member}" belongs to the union defined elsewhere; import an exported constant or schema instead.`,
  ),
);

const violations = [...duplicateUnionViolations, ...memberLeakViolations];

if (violations.length > 0) {
  failPolicy(`Literal unions must have a single owner:\n${Arr.join(violations, "\n")}`);
}
