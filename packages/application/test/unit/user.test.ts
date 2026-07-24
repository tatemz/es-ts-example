import { expect, test } from "bun:test";
import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  ArticleList,
  BookmarkProjection,
  DomainEventStore,
  ListArticles,
  makeListArticlesHandler,
  makeUserCommandHandler,
  ToggleArticleBookmark,
  type ToggleArticleBookmarkCommand,
  UserBookmarkReceipt,
  UserCommand,
  UserCommandClient,
  UserCommandClientLive,
  UserCommandError,
  UserQueryClient,
  UserQueryClientLive,
  articleCatalog,
  bookmarkKey,
  userBookmarkReceiptFromAggregate,
  userMetadata,
} from "../../src/index.ts";

const userId = Domain.UserId.make("user-1");
const articleId = Domain.ArticleId.make("events-over-state");

test("user rpc contracts, metadata, catalog, and empty receipts are explicit", () => {
  const payload: ToggleArticleBookmarkCommand = {
    _tag: "ToggleArticleBookmark",
    userId,
    articleId,
  };

  expect({
    toggleTag: ToggleArticleBookmark._tag,
    listTag: ListArticles._tag,
    decodedPayload: Schema.decodeUnknownSync(ToggleArticleBookmark.payloadSchema)(payload),
    commandAccepted: Schema.is(UserCommand)(payload),
    commandRejected: Schema.is(UserCommand)({ _tag: "Unknown", userId, articleId }),
    commandClientKey: UserCommandClient.key,
    queryClientKey: UserQueryClient.key,
    projectionId: BookmarkProjection.projectionId,
    key: bookmarkKey(userId, articleId),
    catalogSize: articleCatalog.length,
    emptyReceipt: userBookmarkReceiptFromAggregate(Domain.emptyUser(userId)),
    defaultMetadata: userMetadata(payload),
    explicitMetadata: userMetadata({
      ...payload,
      correlationId: "correlation",
      causationId: "causation",
    }),
    decodedList: Schema.decodeUnknownSync(ArticleList)({
      articles: [{ articleId, title: "Events Over State", bookmarked: false }],
    }),
    decodedReceipt: Schema.decodeUnknownSync(UserBookmarkReceipt)({
      userId,
      bookmarkedArticleIds: [articleId],
    }),
    articleReadRejectsEmpty: !Schema.is(ArticleList)({ articles: [{}] }),
    articleListRejectsEmpty: !Schema.is(ArticleList)({}),
    receiptRejectsEmpty: !Schema.is(UserBookmarkReceipt)({}),
    commandErrorAcceptsConflict: Schema.is(UserCommandError)(
      EventStore.ExpectedVersionConflict.make({
        aggregateId: userId,
        expectedVersion: 1,
        actualVersion: 2,
      }),
    ),
    commandErrorAcceptsPersistence: Schema.is(UserCommandError)(
      EventStore.EventStorePersistenceFailure.make({ message: "failed" }),
    ),
  }).toEqual({
    toggleTag: "ToggleArticleBookmark",
    listTag: "ListArticles",
    decodedPayload: payload,
    commandAccepted: true,
    commandRejected: false,
    commandClientKey: "UserCommandClient",
    queryClientKey: "UserQueryClient",
    projectionId: "user-bookmarks",
    key: "6:user-1:events-over-state",
    catalogSize: 5,
    emptyReceipt: { userId, bookmarkedArticleIds: [] },
    defaultMetadata: {
      correlationId: "ToggleArticleBookmark:user-1",
      causationId: undefined,
    },
    explicitMetadata: {
      correlationId: "correlation",
      causationId: "causation",
    },
    decodedList: {
      articles: [{ articleId, title: "Events Over State", bookmarked: false }],
    },
    decodedReceipt: { userId, bookmarkedArticleIds: [articleId] },
    articleReadRejectsEmpty: true,
    articleListRejectsEmpty: true,
    receiptRejectsEmpty: true,
    commandErrorAcceptsConflict: true,
    commandErrorAcceptsPersistence: true,
  });
});

testEffect("list articles combines the static catalog with the bookmark projection", () =>
  Effect.gen(function* () {
    const store = yield* EventStore.makeInMemoryEventStore<Domain.UserEvent>();
    const handle = makeUserCommandHandler(store);
    const listArticles = makeListArticlesHandler(store);
    const query = { _tag: "ListArticles" as const, userId };

    const untouched = yield* listArticles(query);
    const first = yield* handle({ _tag: "ToggleArticleBookmark", userId, articleId });
    const bookmarked = yield* listArticles(query);
    const second = yield* handle({ _tag: "ToggleArticleBookmark", userId, articleId });
    const removed = yield* listArticles(query);

    expect({
      untouched: untouched.articles[0],
      bookmarked: bookmarked.articles[0],
      removed: removed.articles[0],
      catalog: untouched.articles,
      first: first.state,
      second: second.state,
    }).toEqual({
      untouched: { articleId, title: "Events Over State", bookmarked: false },
      bookmarked: { articleId, title: "Events Over State", bookmarked: true },
      removed: { articleId, title: "Events Over State", bookmarked: false },
      catalog: [
        { articleId, title: "Events Over State", bookmarked: false },
        {
          articleId: Domain.ArticleId.make("effective-boundaries"),
          title: "Effective Boundaries",
          bookmarked: false,
        },
        {
          articleId: Domain.ArticleId.make("projections-as-products"),
          title: "Projections Are Products",
          bookmarked: false,
        },
        {
          articleId: Domain.ArticleId.make("small-batches"),
          title: "Small Batches, Fast Feedback",
          bookmarked: false,
        },
        {
          articleId: Domain.ArticleId.make("boring-software"),
          title: "The Value of Boring Software",
          bookmarked: false,
        },
      ],
      first: Domain.ExistingUser.make({ userId, bookmarkedArticleIds: [articleId] }),
      second: Domain.ExistingUser.make({ userId, bookmarkedArticleIds: [] }),
    });
  }),
);

testEffect("user live clients return catalog rows with projected bookmark status", () =>
  Effect.gen(function* () {
    const commands = yield* UserCommandClient;
    const queries = yield* UserQueryClient;

    const receipt = yield* commands.ToggleArticleBookmark({
      _tag: "ToggleArticleBookmark",
      userId,
      articleId,
    });
    const catalog = yield* queries.ListArticles({ _tag: "ListArticles", userId });

    expect({
      receipt,
      firstArticle: catalog.articles[0],
      articleCount: catalog.articles.length,
    }).toEqual({
      receipt: { userId, bookmarkedArticleIds: [articleId] },
      firstArticle: { articleId, title: "Events Over State", bookmarked: true },
      articleCount: 5,
    });
  }).pipe(
    Effect.provide(UserCommandClientLive),
    Effect.provide(UserQueryClientLive),
    Effect.provide(DomainEventStore.inMemory),
  ),
);
