import { Fragment, type Html } from "../mvc/html.ts";

const emptyHtml = (): Html => Fragment(null);

export const renderNoDetail = (): Html => emptyHtml();

export const postFormEncodingAttributes = (
  encoding: string | undefined,
): { readonly enctype?: string } => {
  if (encoding === undefined) {
    return {};
  }
  return { enctype: encoding };
};
