import * as Schema from "effect/Schema";
import { AlertModel } from "../controls/Alert.model.ts";
import { HtmlDocumentModel } from "../controls/HtmlDocument.model.ts";
import { PostFormModel } from "../controls/PostForm.model.ts";
import { SubmitButtonModel } from "../controls/SubmitButton.model.ts";

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
  button: SubmitButtonModel,
  form: PostFormModel,
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
  alert: AlertModel,
  document: HtmlDocumentModel,
  eyebrow: Schema.String,
  heading: Schema.String,
  intro: Schema.String,
  list: ArticleListPresentation,
});

export type ArticlesPageModel = typeof ArticlesPageModel.Type;
