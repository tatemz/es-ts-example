import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { ToggleArticleBookmarkCommand } from "./commands/index.ts";
import { ListArticlesQuery } from "./queries/index.ts";
import { ArticleList, UserBookmarkReceipt } from "./readModels.ts";

export const UserCommandError = Schema.Union([
  EventStore.ExpectedVersionConflict,
  EventStore.EventStorePersistenceFailure,
]);
export type UserCommandError = typeof UserCommandError.Type;

export const UserQueryError = EventStore.EventStorePersistenceFailure;
export type UserQueryError = typeof UserQueryError.Type;

export const ToggleArticleBookmark = Rpc.make("ToggleArticleBookmark", {
  payload: ToggleArticleBookmarkCommand,
  success: UserBookmarkReceipt,
  error: UserCommandError,
});

export const ListArticles = Rpc.make("ListArticles", {
  payload: ListArticlesQuery,
  success: ArticleList,
  error: UserQueryError,
});

export const UserCommandApi = RpcGroup.make(ToggleArticleBookmark);
export const UserQueryApi = RpcGroup.make(ListArticles);
