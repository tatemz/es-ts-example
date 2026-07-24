import { expect } from "bun:test";
import * as Application from "@es-ts-example/application";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { getArticlesPageController } from "../../../src/controllers/getArticlesPage.controller.ts";
import { postToggleBookmarkController } from "../../../src/controllers/postToggleBookmark.controller.ts";
import type { ArticlesPageModel } from "../../../src/models/ArticlesPage.model.ts";
import { ArticleQueryRpcClient, BookmarkCommandRpcClient } from "../../../src/rpcClients.ts";

const localClients = Layer.mergeAll(
  ArticleQueryRpcClient.local,
  BookmarkCommandRpcClient.local,
).pipe(Layer.provide(Application.DomainEventStore.inMemory));

const firstArticleRow = (page: ArticlesPageModel) =>
  page.list._tag === "ArticleListPopulated" ? page.list.rows[0] : undefined;

const articleRowCount = (page: ArticlesPageModel): number =>
  page.list._tag === "ArticleListPopulated" ? page.list.rows.length : 0;

testEffect("articles page combines the catalog with FooBar's bookmark projection", () =>
  Effect.gen(function* () {
    const initial = yield* getArticlesPageController({});
    const toggled = yield* postToggleBookmarkController({ articleId: "events-over-state" });
    const bookmarked = yield* getArticlesPageController({ error: "command-failed" });
    const unknownError = yield* getArticlesPageController({ error: "unknown" });
    const invalid = yield* postToggleBookmarkController({ articleId: "" });

    const initialRow = firstArticleRow(initial);
    const bookmarkedRow = firstArticleRow(bookmarked);

    expect({
      initialTag: initial.list._tag,
      initialBookmark: initialRow?.bookmark._tag,
      rowCount: articleRowCount(initial),
      toggled,
      bookmarkedTag: bookmarkedRow?.bookmark._tag,
      bookmarkedButton: bookmarkedRow?.button.label,
      failedAlert: bookmarked.alert._tag,
      unknownAlert: unknownError.alert._tag,
      invalid,
    }).toEqual({
      initialTag: "ArticleListPopulated",
      initialBookmark: "ArticleNotSaved",
      rowCount: 5,
      toggled: "/articles",
      bookmarkedTag: "ArticleSaved",
      bookmarkedButton: "Remove bookmark",
      failedAlert: "EsTsExampleAlertVisible",
      unknownAlert: "EsTsExampleAlertHidden",
      invalid: "/articles?error=command-failed",
    });
  }).pipe(Effect.provide(localClients)),
);
