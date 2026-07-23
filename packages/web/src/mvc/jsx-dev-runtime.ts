import { Fragment, jsx, jsxs } from "./jsx-runtime.ts";

type Props = Parameters<typeof jsx>[1];
type Tag = Parameters<typeof jsx>[0];

export const jsxDEV = (
  tag: Tag,
  props: Props,
  _key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
) => jsx(tag, props);

export { Fragment, jsx, jsxs };
