import * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import type * as Events from "./Events.ts";
import * as State from "./State.ts";

const isDoesNotExist = Schema.is(State.UserDoesNotExist);

const bookmarkedArticleIds = (state: State.UserState) =>
  isDoesNotExist(state) ? [] : state.bookmarkedArticleIds;

export const applyUserEvent = (state: State.UserState, event: Events.UserEvent): State.UserState =>
  Match.valueTags(event, {
    ArticleBookmarked: (bookmarked) => {
      const articleIds = bookmarkedArticleIds(state);
      return State.ExistingUser.make({
        userId: bookmarked.userId,
        bookmarkedArticleIds: Fn.pipe(
          articleIds,
          Arr.contains(bookmarked.articleId),
          (alreadyBookmarked) =>
            alreadyBookmarked ? articleIds : Arr.append(articleIds, bookmarked.articleId),
        ),
      });
    },
    ArticleBookmarkRemoved: (removed) =>
      State.ExistingUser.make({
        userId: removed.userId,
        bookmarkedArticleIds: Fn.pipe(
          bookmarkedArticleIds(state),
          Arr.filter((articleId) => articleId !== removed.articleId),
        ),
      }),
  });

/** The state a log of user events adds up to, with no aggregate wrapper. */
export const userStateFrom = EventSourcingAggregate.replayInto(
  State.initialUserState,
  applyUserEvent,
);
