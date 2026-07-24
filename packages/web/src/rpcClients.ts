import * as Application from "@es-ts-example/application";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

type CounterCommandHandler<Tag extends Application.CounterCommand["_tag"]> = (
  command: Extract<Application.CounterCommand, { readonly _tag?: Tag }>,
) => Effect.Effect<Application.CounterCommandReceipt, unknown>;

export type CounterCommandRpcClient = {
  readonly [Tag in Application.CounterCommand["_tag"]]: CounterCommandHandler<Tag>;
};

export type CounterQueryRpcClient = {
  readonly ListCounters: (
    query: Readonly<Record<PropertyKey, never>>,
  ) => Effect.Effect<Application.CounterList, unknown>;
};

export type CommandRpcClient = CounterCommandRpcClient;
const CommandRpcClientTag = Context.Service<CommandRpcClient>("CommandRpcClient");
export const CommandRpcClient = Object.assign(CommandRpcClientTag, {
  local: Layer.effect(CommandRpcClientTag, Application.CounterCommandClient).pipe(
    Layer.provide(Application.CounterCommandClientLive),
  ),
});

export type QueryRpcClient = CounterQueryRpcClient;
const QueryRpcClientTag = Context.Service<QueryRpcClient>("QueryRpcClient");
export const QueryRpcClient = Object.assign(QueryRpcClientTag, {
  local: Layer.effect(QueryRpcClientTag, Application.CounterQueryClient).pipe(
    Layer.provide(Application.CounterQueryClientLive),
  ),
});

export type BookmarkCommandRpcClient = {
  readonly ToggleArticleBookmark: (
    command: Application.ToggleArticleBookmarkCommand,
  ) => Effect.Effect<Application.UserBookmarkReceipt, unknown>;
};

const BookmarkCommandRpcClientTag = Context.Service<BookmarkCommandRpcClient>(
  "BookmarkCommandRpcClient",
);
export const BookmarkCommandRpcClient = Object.assign(BookmarkCommandRpcClientTag, {
  local: Layer.effect(BookmarkCommandRpcClientTag, Application.UserCommandClient).pipe(
    Layer.provide(Application.UserCommandClientLive),
  ),
});

export type ArticleQueryRpcClient = {
  readonly ListArticles: (
    query: Application.ListArticlesQuery,
  ) => Effect.Effect<Application.ArticleList, unknown>;
};

const ArticleQueryRpcClientTag = Context.Service<ArticleQueryRpcClient>("ArticleQueryRpcClient");
export const ArticleQueryRpcClient = Object.assign(ArticleQueryRpcClientTag, {
  local: Layer.effect(ArticleQueryRpcClientTag, Application.UserQueryClient).pipe(
    Layer.provide(Application.UserQueryClientLive),
  ),
});
