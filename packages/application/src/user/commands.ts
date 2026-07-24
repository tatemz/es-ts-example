import * as Domain from "@es-ts-example/domain";
import * as Schema from "effect/Schema";

const UserCommandFields = {
  userId: Domain.UserId,
  articleId: Domain.ArticleId,
};

export const ToggleArticleBookmarkCommand = Schema.TaggedStruct("ToggleArticleBookmark", {
  ...UserCommandFields,
});
export type ToggleArticleBookmarkCommand = typeof ToggleArticleBookmarkCommand.Type;

export const UserCommand = Schema.Union([ToggleArticleBookmarkCommand]);
export type UserCommand = typeof UserCommand.Type;
