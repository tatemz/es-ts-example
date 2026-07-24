import * as Application from "@es-ts-example/application";
import * as Effect from "effect/Effect";
import { makeArticlesPageModel } from "../factories/pages/ArticlesPage.factory.ts";
import type { ArticlesPageModel } from "../models/pages/ArticlesPage.model.ts";

export type GetArticlesPageInput = {
  readonly error?: string;
};

const loggedInUserId = "FooBar" as Application.UserId;

export const getArticlesPageController = (
  input: GetArticlesPageInput,
): Effect.Effect<ArticlesPageModel, Application.UserQueryError, Application.UserQueryClient> =>
  Effect.gen(function* () {
    const queries = yield* Application.UserQueryClient;
    const list = yield* queries.ListArticles({
      _tag: "ListArticles",
      userId: loggedInUserId,
    });
    return makeArticlesPageModel({
      articles: list.articles,
      error: input.error === "command-failed" ? "command-failed" : undefined,
    });
  });
