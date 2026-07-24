import * as Domain from "@es-ts-example/domain";
import * as Effect from "effect/Effect";
import { DomainEventStore, narrowDomainEventStore } from "../services.ts";
import { makeToggleArticleBookmarkHandler } from "./commands/index.ts";
import { makeListArticlesHandler } from "./queries/index.ts";
import { userBookmarkReceiptFromAggregate } from "./readModels.ts";
import { UserCommandApi, UserQueryApi } from "./rpc.ts";

const makeUserStore = Effect.map(DomainEventStore, (store) =>
  narrowDomainEventStore(Domain.UserEvent, store),
);

export const UserCommandHandlers = UserCommandApi.toLayer(
  Effect.gen(function* () {
    const store = yield* makeUserStore;
    const toggleArticleBookmark = makeToggleArticleBookmarkHandler(store);

    return UserCommandApi.of({
      ToggleArticleBookmark: (command) =>
        Effect.map(toggleArticleBookmark(command), userBookmarkReceiptFromAggregate),
    });
  }),
);

export const UserQueryHandlers = UserQueryApi.toLayer(
  Effect.gen(function* () {
    const store = yield* makeUserStore;
    const listArticles = makeListArticlesHandler(store);

    return UserQueryApi.of({
      ListArticles: listArticles,
    });
  }),
);
