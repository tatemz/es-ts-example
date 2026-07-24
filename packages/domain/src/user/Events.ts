import * as Schema from "effect/Schema";
import * as Identifiers from "./Identifiers.ts";

export const ArticleBookmarked = Schema.TaggedStruct("ArticleBookmarked", {
  userId: Identifiers.UserId,
  articleId: Identifiers.ArticleId,
});
export type ArticleBookmarked = typeof ArticleBookmarked.Type;

export const ArticleBookmarkRemoved = Schema.TaggedStruct("ArticleBookmarkRemoved", {
  userId: Identifiers.UserId,
  articleId: Identifiers.ArticleId,
});
export type ArticleBookmarkRemoved = typeof ArticleBookmarkRemoved.Type;

export const UserEvent = Schema.Union([ArticleBookmarked, ArticleBookmarkRemoved]);
export type UserEvent = typeof UserEvent.Type;
