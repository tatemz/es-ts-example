import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import { UserCommandMetadata } from "./commandMetadata.ts";
import { makeUserHandler } from "./makeUserHandler.ts";

export const ToggleArticleBookmarkCommand = Schema.TaggedStruct("ToggleArticleBookmark", {
  ...UserCommandMetadata,
});
export type ToggleArticleBookmarkCommand = typeof ToggleArticleBookmarkCommand.Type;
export type ToggleArticleBookmarkCommandError<StoreError = never> =
  | EventStore.ExpectedVersionConflict
  | StoreError;

export const makeToggleArticleBookmarkHandler = <StoreError>(
  store: EventStore.EventStore<Domain.UserEvent, StoreError>,
) =>
  makeUserHandler<ToggleArticleBookmarkCommand, StoreError>(store, (command) =>
    Domain.toggleArticleBookmark({ articleId: command.articleId }),
  );
