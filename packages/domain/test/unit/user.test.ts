import { describe, expect, test } from "bun:test";
import { requireAcceptedDecision } from "@es-ts-example/test-support/Decision";
import * as Schema from "effect/Schema";
import * as Domain from "../../src/index.ts";

const userId = Domain.UserId.make("user-1");
const firstArticleId = Domain.ArticleId.make("article-1");
const secondArticleId = Domain.ArticleId.make("article-2");

const emptyUser = (): Domain.UserAggregate => Domain.emptyUser(userId);

const toggle = (
  aggregate: Domain.UserAggregate,
  articleId: Domain.ArticleId,
): Domain.UserAggregate =>
  requireAcceptedDecision(
    Domain.toggleArticleBookmark({ articleId })(aggregate),
    "toggle article bookmark decision",
  );

describe("User bookmarks", () => {
  test("starts nonexistent and exists after its first interaction", () => {
    expect({
      validUserId: Schema.is(Domain.UserId)("user-1"),
      invalidUserId: Schema.is(Domain.UserId)(""),
      validArticleId: Schema.is(Domain.ArticleId)("article-1"),
      invalidArticleId: Schema.is(Domain.ArticleId)(""),
      userIdBrand: JSON.stringify(Domain.UserId.ast).includes("UserId"),
      articleIdBrand: JSON.stringify(Domain.ArticleId.ast).includes("ArticleId"),
      stateAcceptsMissing: Schema.is(Domain.UserState)(Domain.UserDoesNotExist.make({})),
      stateAcceptsExisting: Schema.is(Domain.UserState)(
        Domain.ExistingUser.make({ userId, bookmarkedArticleIds: [firstArticleId] }),
      ),
      existingTag: JSON.stringify(Domain.ExistingUser.ast).includes("ExistingUser"),
      empty: emptyUser(),
      firstInteraction: toggle(emptyUser(), firstArticleId).state,
    }).toEqual({
      validUserId: true,
      invalidUserId: false,
      validArticleId: true,
      invalidArticleId: false,
      userIdBrand: true,
      articleIdBrand: true,
      stateAcceptsMissing: true,
      stateAcceptsExisting: true,
      existingTag: true,
      empty: {
        aggregateId: userId,
        state: Domain.UserDoesNotExist.make({}),
        version: 0,
        pendingEvents: [],
      },
      firstInteraction: Domain.ExistingUser.make({
        userId,
        bookmarkedArticleIds: [firstArticleId],
      }),
    });
  });

  test("toggles bookmarks independently", () => {
    const firstBookmarked = toggle(emptyUser(), firstArticleId);
    const bothBookmarked = toggle(firstBookmarked, secondArticleId);
    const firstRemoved = toggle(bothBookmarked, firstArticleId);

    expect({
      bothBookmarked: bothBookmarked.state,
      firstRemoved: firstRemoved.state,
      events: firstRemoved.pendingEvents,
    }).toEqual({
      bothBookmarked: Domain.ExistingUser.make({
        userId,
        bookmarkedArticleIds: [firstArticleId, secondArticleId],
      }),
      firstRemoved: Domain.ExistingUser.make({
        userId,
        bookmarkedArticleIds: [secondArticleId],
      }),
      events: [
        Domain.ArticleBookmarked.make({ userId, articleId: firstArticleId }),
        Domain.ArticleBookmarked.make({ userId, articleId: secondArticleId }),
        Domain.ArticleBookmarkRemoved.make({ userId, articleId: firstArticleId }),
      ],
    });
  });

  test("reconstitutes bookmark history without pending events", () => {
    const reconstituted = Domain.reconstituteUser(userId)([
      Domain.ArticleBookmarked.make({ userId, articleId: firstArticleId }),
      Domain.ArticleBookmarked.make({ userId, articleId: secondArticleId }),
      Domain.ArticleBookmarkRemoved.make({ userId, articleId: firstArticleId }),
    ]);

    expect(reconstituted).toEqual({
      aggregateId: userId,
      state: Domain.ExistingUser.make({
        userId,
        bookmarkedArticleIds: [secondArticleId],
      }),
      version: 3,
      pendingEvents: [],
    });
  });

  test("keeps replay total for duplicate and out-of-order facts", () => {
    const duplicate = Domain.applyUserEvent(
      Domain.ExistingUser.make({ userId, bookmarkedArticleIds: [firstArticleId] }),
      Domain.ArticleBookmarked.make({ userId, articleId: firstArticleId }),
    );
    const removedFromMissing = Domain.applyUserEvent(
      Domain.initialUserState,
      Domain.ArticleBookmarkRemoved.make({ userId, articleId: firstArticleId }),
    );

    expect({ duplicate, removedFromMissing }).toEqual({
      duplicate: Domain.ExistingUser.make({
        userId,
        bookmarkedArticleIds: [firstArticleId],
      }),
      removedFromMissing: Domain.ExistingUser.make({ userId, bookmarkedArticleIds: [] }),
    });
  });
});
