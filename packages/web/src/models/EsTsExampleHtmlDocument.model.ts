import * as Schema from "effect/Schema";

export const EsTsExampleHtmlDocumentModel = Schema.TaggedStruct("EsTsExampleHtmlDocumentModel", {
  description: Schema.String,
  stylesheetHref: Schema.String,
  title: Schema.String,
});

export type EsTsExampleHtmlDocumentModel = typeof EsTsExampleHtmlDocumentModel.Type;
