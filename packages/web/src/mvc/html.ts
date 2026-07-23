import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

export type Html = {
  readonly kind: "Html";
  readonly value: string;
};
const HtmlSchema = Schema.Struct({
  kind: Schema.Literal("Html"),
  value: Schema.String,
});

export type Child = Html | string | number | boolean | null | undefined | ReadonlyArray<Child>;
type Props = Readonly<Record<string, unknown>>;
type Component = (props: Props | null) => Html;

declare global {
  namespace JSX {
    type Element = Html;
    interface IntrinsicElements {
      readonly [elementName: string]: Props;
    }
  }
}

const escapeHtml = (value: string): string =>
  Fn.pipe(
    value,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll('"', "&quot;"),
    Str.replaceAll("'", "&#39;"),
  );

export const html = (value: string): Html => ({
  kind: "Html",
  value,
});

const isHtml = Schema.is(HtmlSchema);

export const renderHtml = (value: Html | string): string => (isHtml(value) ? value.value : value);
export const htmlDocument = (value: Html): Html => html(`<!doctype html>${renderHtml(value)}`);

const childRendersEmpty = (child: Child): boolean =>
  child === undefined || child === null || child === false;

const renderChild = (child: Child): string => {
  if (childRendersEmpty(child)) {
    return "";
  }

  if (isHtml(child)) {
    return child.value;
  }

  if (Arr.isArray<Child>(child)) {
    return Fn.pipe(child, Arr.map(renderChild), Arr.join(""));
  }

  return escapeHtml(String(child));
};

export const joinHtml = (fragments: ReadonlyArray<Html>): Html =>
  html(Fn.pipe(fragments, Arr.map(renderHtml), Arr.join("")));

const attributeName = (name: string): string => (name === "className" ? "class" : name);

const attributeRendersEmpty = (name: string, value: unknown): boolean =>
  name === "children" || value === undefined || value === null || value === false;

const renderAttribute = ([name, value]: readonly [string, unknown]): string => {
  if (attributeRendersEmpty(name, value)) {
    return "";
  }

  if (value === true) {
    return ` ${attributeName(name)}`;
  }

  return ` ${attributeName(name)}="${escapeHtml(String(value))}"`;
};

const renderAttributes = (props: Props | null | undefined): string =>
  Fn.pipe(
    Option.fromNullishOr(props),
    Option.map((attributes) =>
      Fn.pipe(attributes, Rec.toEntries, Arr.map(renderAttribute), Arr.join("")),
    ),
    Option.getOrElse(() => ""),
  );

/**
 * Handles both invocation styles: the classic runtime passes children as rest
 * arguments, the automatic (react-jsx) runtime passes them via props.children.
 */
export const Fragment = (
  props: (Props & { readonly children?: Child }) | null | undefined,
  ...children: ReadonlyArray<Child>
): Html =>
  html(
    children.length > 0
      ? Fn.pipe(children, Arr.map(renderChild), Arr.join(""))
      : renderChild(props?.children),
  );

export const jsx = (
  tag: string | Component,
  props: Props | null | undefined,
  ...children: ReadonlyArray<Child>
): Html =>
  typeof tag === "function"
    ? tag({ ...(props ?? {}), children: Fragment(undefined, ...children) })
    : html(
        `<${tag}${renderAttributes(props)}>${renderHtml(Fragment(undefined, ...children))}</${tag}>`,
      );
