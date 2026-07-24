import { expect, test } from "bun:test";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as FastCheck from "effect/testing/FastCheck";
import {
  ArticleBookmarked,
  ArticleBookmarkRemoved,
  ArticleId,
  ExistingUser,
  UserId,
  applyUserEvent,
} from "../../src/index.ts";

const userId = UserId.make("user-property");

test("property: bookmarking an existing article is idempotent", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string({ minLength: 1 }), (rawArticleId) => {
      const articleId = ArticleId.make(rawArticleId);
      const state = ExistingUser.make({ userId, bookmarkedArticleIds: [articleId] });

      expect(applyUserEvent(state, ArticleBookmarked.make({ userId, articleId }))).toEqual(state);
    }),
    propertyTestParameters,
  );
});

test("property: removing a bookmarked article removes exactly that entry", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string({ minLength: 1 }), (rawArticleId) => {
      const articleId = ArticleId.make(rawArticleId);

      expect(
        applyUserEvent(
          ExistingUser.make({ userId, bookmarkedArticleIds: [articleId] }),
          ArticleBookmarkRemoved.make({ userId, articleId }),
        ),
      ).toEqual(ExistingUser.make({ userId, bookmarkedArticleIds: [] }));
    }),
    propertyTestParameters,
  );
});
