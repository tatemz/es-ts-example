import * as Schema from "effect/Schema";
import { EsTsExampleAlertModel } from "./EsTsExampleAlert.model.ts";
import { EsTsExampleHtmlDocumentModel } from "./EsTsExampleHtmlDocument.model.ts";
import { EsTsExamplePostFormModel } from "./EsTsExamplePostForm.model.ts";
import { EsTsExampleSubmitButtonModel } from "./EsTsExampleSubmitButton.model.ts";

const ArticleSaved = Schema.TaggedStruct("ArticleSaved", {
  statusText: Schema.String,
});

const ArticleNotSaved = Schema.TaggedStruct("ArticleNotSaved", {
  statusText: Schema.String,
});

const ArticleBookmarkPresentation = Schema.Union([ArticleSaved, ArticleNotSaved]);

const ArticleRow = Schema.Struct({
  articleId: Schema.String,
  bookmark: ArticleBookmarkPresentation,
  button: EsTsExampleSubmitButtonModel,
  form: EsTsExamplePostFormModel,
  indexText: Schema.String,
  title: Schema.String,
});

const ArticleListEmpty = Schema.TaggedStruct("ArticleListEmpty", {
  message: Schema.String,
});

const ArticleListPopulated = Schema.TaggedStruct("ArticleListPopulated", {
  rows: Schema.NonEmptyArray(ArticleRow),
});

const ArticleListPresentation = Schema.Union([ArticleListEmpty, ArticleListPopulated]);

export const ArticlesPageModel = Schema.TaggedStruct("ArticlesPageModel", {
  alert: EsTsExampleAlertModel,
  document: EsTsExampleHtmlDocumentModel,
  eyebrow: Schema.String,
  heading: Schema.String,
  intro: Schema.String,
  list: ArticleListPresentation,
});

export type ArticlesPageModel = typeof ArticlesPageModel.Type;
