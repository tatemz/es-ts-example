import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import { makeArticlesPageModel } from "../../../src/factories/ArticlesPage.factory.ts";
import { ArticlesPageModel } from "../../../src/models/ArticlesPage.model.ts";
import { renderHtml } from "../../../src/mvc/html.ts";
import { ArticlesPageView } from "../../../src/views/wayfinder/ArticlesPage.view.tsx";

test("articles page renders exact empty and populated editorial states", () => {
  const empty = renderHtml(
    ArticlesPageView(makeArticlesPageModel({ articles: [], error: "command-failed" })),
  );
  const populatedModel = makeArticlesPageModel({
    articles: [
      { articleId: "events-over-state", title: "Events Over State", bookmarked: true },
      { articleId: "effective-boundaries", title: "Effective Boundaries", bookmarked: false },
    ],
  });
  const populated = renderHtml(ArticlesPageView(populatedModel));
  const malformedRowRejected = !Schema.is(ArticlesPageModel)({
    ...populatedModel,
    list: { _tag: "ArticleListPopulated", rows: [{}] },
  });

  expect({ empty, populated, malformedRowRejected }).toEqual({
    empty:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>Reading Room</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="EsTsExampleHtmlDocument" data-layout-theme="wayfinder" data-theme="es-ts-example"><main class="mx-auto grid min-h-screen w-full max-w-4xl content-start gap-10 px-6 py-12 sm:px-10 sm:py-16" data-component="ArticlesPage"><header class="grid max-w-2xl gap-4"><p class="font-mono text-xs uppercase tracking-[0.3em] text-primary">Issue 001</p><h1 class="font-serif text-5xl font-bold leading-none text-base-content sm:text-7xl">Reading Room</h1><p class="max-w-xl text-lg leading-relaxed text-base-content/65">A static shelf with bookmark state rebuilt from FooBar&#39;s event stream.</p></header><p class="alert alert-error" data-component="EsTsExampleAlert" role="alert">That bookmark could not be changed.</p><p class="border-t border-base-300 py-8 text-base-content/60" data-role="article-list-empty">The reading room is empty.</p></main></body></html>',
    populated:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>Reading Room</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="EsTsExampleHtmlDocument" data-layout-theme="wayfinder" data-theme="es-ts-example"><main class="mx-auto grid min-h-screen w-full max-w-4xl content-start gap-10 px-6 py-12 sm:px-10 sm:py-16" data-component="ArticlesPage"><header class="grid max-w-2xl gap-4"><p class="font-mono text-xs uppercase tracking-[0.3em] text-primary">Issue 001</p><h1 class="font-serif text-5xl font-bold leading-none text-base-content sm:text-7xl">Reading Room</h1><p class="max-w-xl text-lg leading-relaxed text-base-content/65">A static shelf with bookmark state rebuilt from FooBar&#39;s event stream.</p></header><ol class="grid" data-role="article-list"><li class="group grid gap-5 border-t border-base-300 py-6 sm:grid-cols-[4rem_1fr_auto] sm:items-center" data-article-id="events-over-state"><span class="font-mono text-xs tracking-[0.24em] text-base-content/40">01</span><section class="grid gap-2"><h2 class="font-serif text-2xl font-semibold leading-tight text-base-content">Events Over State</h2><div class="flex flex-wrap items-center gap-3"><span class="badge badge-primary badge-outline" data-role="bookmark-status">Saved</span><span class="font-mono text-xs text-base-content/45">events-over-state</span></div></section><form action="/actions/articles/toggle-bookmark" class="contents" data-component="EsTsExamplePostForm" data-design-id="post-form" method="post"><input name="articleId" type="hidden" value="events-over-state"></input><button class="btn btn-secondary btn-outline" data-component="EsTsExampleSubmitButton" data-design-id="submit-button" type="submit">Remove bookmark</button></form></li><li class="group grid gap-5 border-t border-base-300 py-6 sm:grid-cols-[4rem_1fr_auto] sm:items-center" data-article-id="effective-boundaries"><span class="font-mono text-xs tracking-[0.24em] text-base-content/40">02</span><section class="grid gap-2"><h2 class="font-serif text-2xl font-semibold leading-tight text-base-content">Effective Boundaries</h2><div class="flex flex-wrap items-center gap-3"><span class="badge badge-ghost" data-role="bookmark-status">Not saved</span><span class="font-mono text-xs text-base-content/45">effective-boundaries</span></div></section><form action="/actions/articles/toggle-bookmark" class="contents" data-component="EsTsExamplePostForm" data-design-id="post-form" method="post"><input name="articleId" type="hidden" value="effective-boundaries"></input><button class="btn btn-primary" data-component="EsTsExampleSubmitButton" data-design-id="submit-button" type="submit">Bookmark</button></form></li></ol></main></body></html>',
    malformedRowRejected: true,
  });
});
