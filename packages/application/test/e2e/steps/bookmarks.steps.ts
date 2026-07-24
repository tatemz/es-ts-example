import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { Bdd } from "effect-bdd";
import {
  type ArticleList,
  makeListArticlesHandler,
  makeUserCommandHandler,
} from "../../../src/index.ts";
import { assertBookmarkedArticles, assertListedArticles } from "../support/Assertions.ts";

const reader = Domain.UserId.make("reader-1");
const otherReader = Domain.UserId.make("reader-2");

const catalogArticleIds = Arr.make(
  "events-over-state",
  "effective-boundaries",
  "projections-as-products",
  "small-batches",
  "boring-software",
);

type BookmarkScenarioState = {
  readonly store: EventStore.EventStore<Domain.UserEvent> | undefined;
  readonly viewer: Domain.UserId;
};

const initialScenarioState: BookmarkScenarioState = {
  store: undefined,
  viewer: reader,
};

const emptyStore = (): Effect.Effect<EventStore.EventStore<Domain.UserEvent>> =>
  EventStore.makeInMemoryEventStore<Domain.UserEvent>();

const resetScenario = (): Effect.Effect<BookmarkScenarioState> =>
  Effect.map(emptyStore(), (store) => ({ ...initialScenarioState, store }));

const reject = (message: string): Effect.Effect<never, string> => Effect.fail(message);

const expectStore = (
  state: BookmarkScenarioState,
): Effect.Effect<EventStore.EventStore<Domain.UserEvent>, string> => {
  const store = state.store;

  return store === undefined ? reject("Expected a user event store.") : Effect.succeed(store);
};

/** Toggling a bookmark has no rejection, so any failure here is a broken store. */
const bookmark = (
  state: BookmarkScenarioState,
  articleId: string,
): Effect.Effect<BookmarkScenarioState, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    makeUserCommandHandler(store)({
      _tag: "ToggleArticleBookmark",
      userId: reader,
      articleId: Domain.ArticleId.make(articleId),
    }).pipe(
      Effect.mapError((error) => `Expected the bookmark to be recorded, but got ${error._tag}.`),
      Effect.as(state),
    ),
  );

const articleList = (state: BookmarkScenarioState): Effect.Effect<ArticleList, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    makeListArticlesHandler(store)({ _tag: "ListArticles", userId: state.viewer }).pipe(
      Effect.mapError((error) => error.message),
    ),
  );

const bookmarkedArticleIds = (list: ArticleList): ReadonlyArray<string> =>
  Fn.pipe(
    list.articles,
    Arr.filter((article) => article.bookmarked),
    Arr.map((article) => article.articleId),
  );

const articleId = Bdd.capture("articleId", Schema.String);
const articleIds = Bdd.capture("articleIds", Schema.String);

type ArticleIdCaptures = { readonly articleId: string };
type ArticleIdsCaptures = { readonly articleIds: string };

const givenReaderWithNoBookmarks = Bdd.given`a reader with no bookmarks`(() => resetScenario());

const givenReaderWhoBookmarked = Bdd.given`a reader who bookmarked "${articleId}"`(
  ({ articleId }: ArticleIdCaptures) =>
    Effect.flatMap(resetScenario(), (state) => bookmark(state, articleId)),
);

const whenReaderBookmarks = Bdd.when`the reader bookmarks "${articleId}"`(
  ({ articleId }: ArticleIdCaptures, state: BookmarkScenarioState) => bookmark(state, articleId),
);

const whenDifferentReaderOpensTheList = Bdd.when`the article list is opened by a different reader`(
  (state: BookmarkScenarioState) => Effect.succeed({ ...state, viewer: otherReader }),
);

const thenListShowsBookmarksFor = Bdd.then`the article list shows bookmarks for "${articleIds}"`(
  ({ articleIds }: ArticleIdsCaptures, state: BookmarkScenarioState) =>
    Effect.map(articleList(state), (list) => {
      assertBookmarkedArticles(bookmarkedArticleIds(list), Fn.pipe(articleIds, Str.split(", ")));
      return state;
    }),
);

const thenListShowsNoBookmarks = Bdd.then`the article list shows no bookmarks`(
  (state: BookmarkScenarioState) =>
    Effect.map(articleList(state), (list) => {
      assertBookmarkedArticles(bookmarkedArticleIds(list), []);
      return state;
    }),
);

const thenListShowsEveryArticle =
  Bdd.then`the article list still shows every article in the catalog`(
    (state: BookmarkScenarioState) =>
      Effect.map(articleList(state), (list) => {
        assertListedArticles(
          Fn.pipe(
            list.articles,
            Arr.map((article) => article.articleId),
          ),
          catalogArticleIds,
        );
        return state;
      }),
  );

const bookmarkingAnArticle = Bdd.scenario("Bookmarking an article").pipe(
  givenReaderWithNoBookmarks,
  whenReaderBookmarks,
  thenListShowsBookmarksFor,
  thenListShowsEveryArticle,
);

const bookmarkingAgainRemovesTheBookmark = Bdd.scenario(
  "Bookmarking the same article again removes the bookmark",
).pipe(
  givenReaderWhoBookmarked,
  whenReaderBookmarks,
  thenListShowsNoBookmarks,
  thenListShowsEveryArticle,
);

const bookmarkingASecondArticleKeepsTheFirst = Bdd.scenario(
  "Bookmarking a second article keeps the first",
).pipe(givenReaderWhoBookmarked, whenReaderBookmarks, thenListShowsBookmarksFor);

const bookmarksBelongToOneReader = Bdd.scenario(
  "One reader's bookmarks belong to that reader alone",
).pipe(givenReaderWhoBookmarked, whenDifferentReaderOpensTheList, thenListShowsNoBookmarks);

const removingOneBookmarkLeavesTheOthers = Bdd.scenario(
  "Removing one bookmark leaves the others alone",
).pipe(
  givenReaderWhoBookmarked,
  whenReaderBookmarks,
  whenReaderBookmarks,
  thenListShowsBookmarksFor,
);

export const bookmarks = Bdd.feature("Article bookmarks").pipe(
  bookmarkingAnArticle,
  bookmarkingAgainRemovesTheBookmark,
  bookmarkingASecondArticleKeepsTheFirst,
  bookmarksBelongToOneReader,
  removingOneBookmarkLeavesTheOthers,
);
