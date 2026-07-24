import { Fragment, type Html } from "../mvc/html.ts";

export const renderNothing = (): Html => Fragment(null);

export const postFormEncodingAttributes = (
  encoding: string | undefined,
): { readonly enctype?: string } => {
  if (encoding === undefined) {
    return {};
  }
  return { enctype: encoding };
};
