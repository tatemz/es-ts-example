import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as FastCheck from "effect/testing/FastCheck";
import {
  applyBookmarkEvent,
  bookmarkKey,
  initialBookmarkProjectionState,
} from "../../src/index.ts";

test("property: bookmark keys distinguish either component", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string(), (suffix) => {
      const firstUser = `a${suffix}`;
      const secondUser = `b${suffix}`;
      const firstArticle = `a${suffix}`;
      const secondArticle = `b${suffix}`;

      expect({
        changedUser: bookmarkKey(firstUser, firstArticle) !== bookmarkKey(secondUser, firstArticle),
        changedArticle:
          bookmarkKey(firstUser, firstArticle) !== bookmarkKey(firstUser, secondArticle),
      }).toEqual({
        changedUser: true,
        changedArticle: true,
      });
    }),
    propertyTestParameters,
  );
});

test("property: the latest bookmark fact controls the projected boolean", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.string({ minLength: 1 }),
      FastCheck.string({ minLength: 1 }),
      (rawUserId, rawArticleId) => {
        const userId = Domain.UserId.make(rawUserId);
        const articleId = Domain.ArticleId.make(rawArticleId);
        const bookmarked = Domain.ArticleBookmarked.make({ userId, articleId });
        const removed = Domain.ArticleBookmarkRemoved.make({ userId, articleId });
        const key = bookmarkKey(userId, articleId);

        expect({
          removedLast: applyBookmarkEvent(
            applyBookmarkEvent(initialBookmarkProjectionState, bookmarked),
            removed,
          ).bookmarks[key],
          bookmarkedLast: applyBookmarkEvent(
            applyBookmarkEvent(initialBookmarkProjectionState, removed),
            bookmarked,
          ).bookmarks[key],
        }).toEqual({
          removedLast: false,
          bookmarkedLast: true,
        });
      },
    ),
    propertyTestParameters,
  );
});
