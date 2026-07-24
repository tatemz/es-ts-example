import * as EventSourcingDecision from "@es-ts-example/event-sourcing/decision";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import * as Aggregate from "./Aggregate.ts";
import * as Events from "./Events.ts";
import type * as Identifiers from "./Identifiers.ts";
import * as State from "./State.ts";

export type UserDecision<Error> = EventSourcingDecision.Decision<Aggregate.UserAggregate, Error>;

export const toggleArticleBookmark =
  (input: { readonly articleId: Identifiers.ArticleId }) =>
  (aggregate: Aggregate.UserAggregate): UserDecision<never> => {
    const isBookmarked =
      Schema.is(State.ExistingUser)(aggregate.state) &&
      Arr.contains(aggregate.state.bookmarkedArticleIds, input.articleId);
    const event = isBookmarked
      ? Events.ArticleBookmarkRemoved.make({
          userId: aggregate.aggregateId,
          articleId: input.articleId,
        })
      : Events.ArticleBookmarked.make({
          userId: aggregate.aggregateId,
          articleId: input.articleId,
        });

    return EventSourcingDecision.accept(Aggregate.recordUserEvent(event)(aggregate));
  };
