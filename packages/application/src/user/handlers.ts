import * as Domain from "@es-ts-example/domain";
import * as Effect from "effect/Effect";
import { DomainEventStore, eventStoreFor } from "../eventStore.ts";
import type { UserCommand } from "./commands.ts";
import { makeListArticlesHandler } from "./queries/index.ts";
import { userBookmarkReceiptFromAggregate } from "./readModels.ts";
import { makeUserRepository, type UserEventStore } from "./repository.ts";
import { UserCommandApi, UserQueryApi } from "./rpc.ts";

const makeUserStore = Effect.map(DomainEventStore, (store) =>
  eventStoreFor(Domain.UserEvent, store),
);

const decide = (
  command: UserCommand,
  aggregate: Domain.UserAggregate,
): Domain.UserDecision<never> =>
  Domain.toggleArticleBookmark({ articleId: command.articleId })(aggregate);

export const makeUserCommandHandler = (store: UserEventStore) => {
  const repository = makeUserRepository(store);

  return (command: UserCommand) =>
    Effect.gen(function* () {
      const user = yield* repository.load(command.userId);

      return yield* repository.commit(decide(command, user));
    });
};

export const UserCommandHandlers = UserCommandApi.toLayer(
  Effect.gen(function* () {
    const handle = makeUserCommandHandler(yield* makeUserStore);

    return UserCommandApi.of({
      ToggleArticleBookmark: (command) =>
        Effect.map(handle(command), userBookmarkReceiptFromAggregate),
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
