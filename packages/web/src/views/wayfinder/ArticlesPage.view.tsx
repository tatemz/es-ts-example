import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import type { ArticlesPageModel } from "../../models/ArticlesPage.model.ts";
import type { View } from "../../mvc/view.ts";
import { EsTsExampleAlertView } from "./EsTsExampleAlert.view.tsx";
import { EsTsExampleHtmlDocumentView } from "./EsTsExampleHtmlDocument.view.tsx";
import { EsTsExamplePostFormView } from "./EsTsExamplePostForm.view.tsx";
import { EsTsExampleSubmitButtonView } from "./EsTsExampleSubmitButton.view.tsx";

type ArticleRow = Extract<
  ArticlesPageModel["list"],
  { readonly _tag: "ArticleListPopulated" }
>["rows"][number];

const bookmarkStatusView = (bookmark: ArticleRow["bookmark"]) =>
  Match.value(bookmark).pipe(
    Match.tagsExhaustive({
      ArticleSaved: ({ statusText }) => (
        <span className="badge badge-primary badge-outline" data-role="bookmark-status">
          {statusText}
        </span>
      ),
      ArticleNotSaved: ({ statusText }) => (
        <span className="badge badge-ghost" data-role="bookmark-status">
          {statusText}
        </span>
      ),
    }),
  );

const articleRowView = (row: ArticleRow) => (
  <li
    className="group grid gap-5 border-t border-base-300 py-6 sm:grid-cols-[4rem_1fr_auto] sm:items-center"
    data-article-id={row.articleId}
  >
    <span className="font-mono text-xs tracking-[0.24em] text-base-content/40">
      {row.indexText}
    </span>
    <section className="grid gap-2">
      <h2 className="font-serif text-2xl font-semibold leading-tight text-base-content">
        {row.title}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {bookmarkStatusView(row.bookmark)}
        <span className="font-mono text-xs text-base-content/45">{row.articleId}</span>
      </div>
    </section>
    {EsTsExamplePostFormView(row.form, EsTsExampleSubmitButtonView(row.button))}
  </li>
);

const articleListView = (list: ArticlesPageModel["list"]) =>
  Match.value(list).pipe(
    Match.tagsExhaustive({
      ArticleListEmpty: ({ message }) => (
        <p
          className="border-t border-base-300 py-8 text-base-content/60"
          data-role="article-list-empty"
        >
          {message}
        </p>
      ),
      ArticleListPopulated: ({ rows }) => (
        <ol className="grid" data-role="article-list">
          {Arr.map(rows, articleRowView)}
        </ol>
      ),
    }),
  );

export const ArticlesPageView: View<ArticlesPageModel> = (model) =>
  EsTsExampleHtmlDocumentView(
    model.document,
    <main
      className="mx-auto grid min-h-screen w-full max-w-4xl content-start gap-10 px-6 py-12 sm:px-10 sm:py-16"
      data-component="ArticlesPage"
    >
      <header className="grid max-w-2xl gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">{model.eyebrow}</p>
        <h1 className="font-serif text-5xl font-bold leading-none text-base-content sm:text-7xl">
          {model.heading}
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-base-content/65">{model.intro}</p>
      </header>
      {EsTsExampleAlertView(model.alert)}
      {articleListView(model.list)}
    </main>,
  );
