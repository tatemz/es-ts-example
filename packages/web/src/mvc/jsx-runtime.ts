import * as Arr from "effect/Array";
import { type Child, jsx as element, Fragment, type Html } from "./html.ts";

type Props = Readonly<Record<string, unknown>>;

const isPrimitiveChild = (value: unknown): boolean =>
  isAbsentChild(value) ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const isAbsentChild = (value: unknown): boolean => value === null || value === undefined;

const isHtmlChild = (value: unknown): value is Html =>
  isObjectLike(value) && "kind" in value && value.kind === "Html";

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isChildArray = (value: unknown): value is ReadonlyArray<Child> =>
  Arr.isArray<unknown>(value) && Arr.every(value, isChild);

const isChild = (value: unknown): value is Child =>
  isPrimitiveChild(value) || isHtmlChild(value) || isChildArray(value);

const normalizeChildren = (children: Child): ReadonlyArray<Child> =>
  Arr.isArray<Child>(children) ? children : [children];

const childrenFromProps = (props: Props | null | undefined): ReadonlyArray<Child> => {
  const children = props?.children;

  if (children === undefined) {
    return [];
  }

  if (!isChild(children)) {
    throw new Error("JSX children must be renderable HTML children.");
  }

  return normalizeChildren(children);
};

const propsWithoutChildren = (props: Props | null | undefined): Props | null | undefined => {
  if (props === undefined || props === null) {
    return props;
  }

  const { children: _children, ...attributes } = props;
  return attributes;
};

export const jsx = (
  tag: string | ((props: Props | null) => Html),
  props: Props | null | undefined,
): Html => element(tag, propsWithoutChildren(props), ...childrenFromProps(props));

export const jsxs = jsx;

export { Fragment };
