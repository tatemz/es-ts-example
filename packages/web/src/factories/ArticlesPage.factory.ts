import * as Arr from "effect/Array";
import { webI18n } from "../i18n/messages.ts";
import { ArticlesPageModel } from "../models/ArticlesPage.model.ts";
import { webActions } from "../routes.ts";
import { makeEsTsExampleAlertModel } from "./EsTsExampleAlert.factory.ts";
import { makeEsTsExampleHtmlDocumentModel } from "./EsTsExampleHtmlDocument.factory.ts";
import { makeEsTsExamplePostFormModel } from "./EsTsExamplePostForm.factory.ts";
import { makeEsTsExampleSubmitButtonModel } from "./EsTsExampleSubmitButton.factory.ts";

type ArticleView = {
  readonly articleId: string;
  readonly bookmarked: boolean;
  readonly title: string;
};

type ArticlesPageInput = {
  readonly articles: ReadonlyArray<ArticleView>;
  readonly error?: "command-failed";
};

const makeBookmarkPresentation = (
  bookmarked: boolean,
): Extract<
  ArticlesPageModel["list"],
  { readonly _tag: "ArticleListPopulated" }
>["rows"][number]["bookmark"] =>
  bookmarked
    ? {
        _tag: "ArticleSaved",
        statusText: webI18n._({ id: "articles.bookmark.saved" }),
      }
    : {
        _tag: "ArticleNotSaved",
        statusText: webI18n._({ id: "articles.bookmark.notSaved" }),
      };

const makeRow = (article: ArticleView, index: number) => ({
  articleId: article.articleId,
  bookmark: makeBookmarkPresentation(article.bookmarked),
  button: makeEsTsExampleSubmitButtonModel({
    label: webI18n._({
      id: article.bookmarked ? "articles.action.remove" : "articles.action.bookmark",
    }),
    tone: article.bookmarked ? ("secondary" as const) : ("primary" as const),
  }),
  form: makeEsTsExamplePostFormModel({
    action: webActions.toggleBookmark,
    hiddenFields: [{ name: "articleId", value: article.articleId }],
  }),
  indexText: `0${index + 1}`,
  title: article.title,
});

const makeList = (articles: ReadonlyArray<ArticleView>): ArticlesPageModel["list"] =>
  Arr.match(articles, {
    onEmpty: () => ({
      _tag: "ArticleListEmpty" as const,
      message: webI18n._({ id: "articles.list.empty" }),
    }),
    onNonEmpty: (nonEmpty) => ({
      _tag: "ArticleListPopulated" as const,
      rows: Arr.map(nonEmpty, (article, index) => makeRow(article, index)),
    }),
  });

export const makeArticlesPageModel = (input: ArticlesPageInput): ArticlesPageModel =>
  ArticlesPageModel.make({
    _tag: "ArticlesPageModel",
    alert: makeEsTsExampleAlertModel({
      message:
        input.error === "command-failed"
          ? webI18n._({ id: "articles.error.commandFailed" })
          : undefined,
    }),
    document: makeEsTsExampleHtmlDocumentModel({
      title: webI18n._({ id: "articles.documentTitle" }),
    }),
    eyebrow: webI18n._({ id: "articles.eyebrow" }),
    heading: webI18n._({ id: "articles.heading" }),
    intro: webI18n._({ id: "articles.intro" }),
    list: makeList(input.articles),
  });
