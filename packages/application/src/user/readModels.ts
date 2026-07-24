import * as Domain from "@es-ts-example/domain";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as Schema from "effect/Schema";
import { articleCatalog } from "./articleCatalog.ts";

export const ArticleRead = Schema.Struct({
  articleId: Domain.ArticleId,
  title: Schema.String,
  bookmarked: Schema.Boolean,
});
export type ArticleRead = typeof ArticleRead.Type;

export const ArticleList = Schema.Struct({
  articles: Schema.Array(ArticleRead),
});
export type ArticleList = typeof ArticleList.Type;

export const UserBookmarkReceipt = Schema.Struct({
  userId: Domain.UserId,
  bookmarkedArticleIds: Schema.Array(Domain.ArticleId),
});
export type UserBookmarkReceipt = typeof UserBookmarkReceipt.Type;

export const userBookmarkReceiptFromAggregate = (
  aggregate: Domain.UserAggregate,
): UserBookmarkReceipt =>
  Match.valueTags(aggregate.state, {
    UserDoesNotExist: () =>
      UserBookmarkReceipt.make({
        userId: aggregate.aggregateId,
        bookmarkedArticleIds: [],
      }),
    ExistingUser: (state) =>
      UserBookmarkReceipt.make({
        userId: state.userId,
        bookmarkedArticleIds: state.bookmarkedArticleIds,
      }),
  });

export type BookmarkProjectionState = {
  readonly bookmarks: Readonly<Record<string, boolean>>;
};

export const initialBookmarkProjectionState: BookmarkProjectionState = {
  bookmarks: {},
};

export const bookmarkKey = (userId: string, articleId: string): string =>
  `${userId.length}:${userId}:${articleId}`;

const isArticleBookmarked = (
  state: BookmarkProjectionState,
  userId: Domain.UserId,
  articleId: Domain.ArticleId,
): boolean =>
  Fn.pipe(
    Rec.get(state.bookmarks, bookmarkKey(userId, articleId)),
    Option.getOrElse(() => false),
  );

export const articleCatalogList = (
  state: BookmarkProjectionState,
  userId: Domain.UserId,
): ArticleList => ({
  articles: Arr.map(articleCatalog, (article) =>
    ArticleRead.make({
      ...article,
      bookmarked: isArticleBookmarked(state, userId, article.articleId),
    }),
  ),
});

export const applyBookmarkEvent = (
  state: BookmarkProjectionState,
  event: Domain.UserEvent,
): BookmarkProjectionState =>
  Match.valueTags(event, {
    ArticleBookmarked: (bookmarked) => ({
      bookmarks: Rec.set(
        state.bookmarks,
        bookmarkKey(bookmarked.userId, bookmarked.articleId),
        true,
      ),
    }),
    ArticleBookmarkRemoved: (removed) => ({
      bookmarks: Rec.set(state.bookmarks, bookmarkKey(removed.userId, removed.articleId), false),
    }),
  });
