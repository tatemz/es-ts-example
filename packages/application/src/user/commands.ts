import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";

const UserCommandMetadata = {
  userId: Domain.UserId,
  articleId: Domain.ArticleId,
  correlationId: Schema.optionalKey(Schema.String),
  causationId: Schema.optionalKey(Schema.String),
};

export const ToggleArticleBookmarkCommand = Schema.TaggedStruct("ToggleArticleBookmark", {
  ...UserCommandMetadata,
});
export type ToggleArticleBookmarkCommand = typeof ToggleArticleBookmarkCommand.Type;

export const UserCommand = Schema.Union([ToggleArticleBookmarkCommand]);
export type UserCommand = typeof UserCommand.Type;

export const userMetadata = (command: UserCommand): EventStore.AppendMetadata => ({
  correlationId: command.correlationId ?? `${command._tag}:${command.userId}`,
  causationId: command.causationId,
});
