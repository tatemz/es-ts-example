import type * as Application from "@es-ts-example/application";
import * as Effect from "effect/Effect";
import { makeArticlesPageModel } from "../factories/ArticlesPage.factory.ts";
import type { ArticlesPageModel } from "../models/ArticlesPage.model.ts";
import { ArticleQueryRpcClient } from "../rpcClients.ts";

export type GetArticlesPageInput = {
  readonly error?: string;
};

const loggedInUserId = "FooBar" as Application.UserId;

export const getArticlesPageController = (
  input: GetArticlesPageInput,
): Effect.Effect<ArticlesPageModel, unknown, ArticleQueryRpcClient> =>
  Effect.gen(function* () {
    const queries = yield* ArticleQueryRpcClient;
    const list = yield* queries.ListArticles({
      _tag: "ListArticles",
      userId: loggedInUserId,
    });
    return makeArticlesPageModel({
      articles: list.articles,
      error: input.error === "command-failed" ? "command-failed" : undefined,
    });
  });
