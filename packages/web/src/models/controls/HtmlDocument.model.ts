import * as Schema from "effect/Schema";

export const HtmlDocumentModel = Schema.TaggedStruct("HtmlDocumentModel", {
  description: Schema.String,
  stylesheetHref: Schema.String,
  title: Schema.String,
});

export type HtmlDocumentModel = typeof HtmlDocumentModel.Type;
