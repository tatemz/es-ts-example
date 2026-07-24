import * as Application from "@es-ts-example/application";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { BookmarkCommandRpcClient } from "../rpcClients.ts";
import { articlesHref } from "../routes.ts";

export type PostToggleBookmarkInput = {
  readonly articleId: string;
};

const loggedInUserId = "FooBar" as Application.UserId;

export const postToggleBookmarkController = (
  input: PostToggleBookmarkInput,
): Effect.Effect<string, never, BookmarkCommandRpcClient> =>
  Effect.gen(function* () {
    const commands = yield* BookmarkCommandRpcClient;
    const articleId = yield* Schema.decodeUnknownEffect(Application.ArticleId)(input.articleId);
    yield* commands.ToggleArticleBookmark({
      _tag: "ToggleArticleBookmark",
      userId: loggedInUserId,
      articleId,
    });
    return articlesHref({});
  }).pipe(Effect.catch(() => Effect.succeed(articlesHref({ error: "command-failed" }))));
